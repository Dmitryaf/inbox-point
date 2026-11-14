package com.inboxpoint.vk;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.inboxpoint.persistence.SqliteTextHandoff;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VkLongPollTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-01T10:02:00Z"), ZoneOffset.UTC);
    private static final String TOKEN = "synthetic-vk-token";
    private static final long GROUP = 48;

    @TempDir
    Path directory;

    @Test
    void resumesFromTheStoredCursorAndDrainsTheBatchBeforePollingAgain() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        var routed = new ArrayList<String>();
        var event = "{\"type\":\"message_new\",\"group_id\":48,\"object\":{},\"event_id\":\"fixture\"}";
        try (var server = new Server(); var http = HttpClient.newHttpClient()) {
            server.update.set("{\"ts\":101,\"updates\":[" + event + "," + event + "]}");
            try (var store = SqliteTextHandoff.open(database, CLOCK.instant())) {
                var poll = poller(store, server, http, routed);
                assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.POLLED);
                assertThat(store.cursor("vk:long-poll")).contains("101");
                assertThat(store.pendingUpdate("vk:long-poll")).get()
                        .extracting(SqliteTextHandoff.PendingUpdate::id).isEqualTo("fixture");
                assertThat(server.form.get()).contains("group_id=48", "access_token=" + TOKEN, "v=5.199");
            }

            server.update.set("{\"ts\":\"102\",\"updates\":[]}");
            try (var store = SqliteTextHandoff.open(database, CLOCK.instant())) {
                var poll = poller(store, server, http, routed);
                assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.PROCESSED);
                assertThat(routed).containsExactly(event);
                assertThat(server.queries).hasSize(1);
                assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.POLLED);
                assertThat(server.queries.getLast()).contains("ts=101");
                assertThat(server.queries.getFirst()).contains("act=a_check", "ts=100", "key=key%2B1", "wait=1");
                assertThat(store.cursor("vk:long-poll")).contains("102");
            }
        }
    }

    @Test
    void distinguishesExpiredKeysFromLostEventHistory() throws Exception {
        try (var server = new Server(); var http = HttpClient.newHttpClient();
                var store = SqliteTextHandoff.open(directory.resolve("inbox.sqlite"), CLOCK.instant())) {
            var poll = poller(store, server, http, new ArrayList<>());
            server.update.set("{\"ts\":\"104\",\"updates\":[]}");
            assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.POLLED);
            server.update.set("{\"failed\":2}");
            assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.KEY_REFRESHED);
            assertThat(server.keyRequests.get()).isEqualTo(2);
            assertThat(store.cursor("vk:long-poll")).contains("104");

            server.update.set("{\"failed\":1,\"ts\":\"108\"}");
            assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.HISTORY_EXPIRED);
            assertThat(server.queries.getLast()).contains("key=key%2B2", "ts=104");
            assertThat(store.cursor("vk:long-poll")).contains("108");
            assertThat(server.keyRequests.get()).isEqualTo(2);

            server.update.set("{\"failed\":3}");
            assertThat(poll.step(1)).isEqualTo(VkLongPoll.Step.HISTORY_EXPIRED);
            assertThat(server.queries.getLast()).contains("ts=108");
            assertThat(server.keyRequests.get()).isEqualTo(3);
            assertThat(store.cursor("vk:long-poll")).contains("300");
        }
    }

    @Test
    void rejectsADifferentCommunityBeforeReadingThePreviousCursorOrRoutingPendingEvents() throws Exception {
        var routed = new ArrayList<String>();
        var event = "{\"type\":\"message_new\",\"group_id\":48,\"object\":{},\"event_id\":\"fixture\"}";
        try (var server = new Server(); var http = HttpClient.newHttpClient();
                var store = SqliteTextHandoff.open(directory.resolve("inbox.sqlite"), CLOCK.instant())) {
            server.update.set("{\"ts\":\"104\",\"updates\":[" + event + "]}");
            assertThat(poller(store, server, http, routed).step(1)).isEqualTo(VkLongPoll.Step.POLLED);
            var other = new VkApiClient(http, server.origin(), TOKEN, Duration.ofSeconds(3));
            assertThatThrownBy(() -> VkLongPoll.connect(store, other, 49, ignored -> routed.add("unexpected"), CLOCK))
                    .hasMessage("VK connection identity conflicts with the existing history");
            assertThat(server.queries).hasSize(1);
            assertThat(routed).isEmpty();
            assertThat(store.cursor("vk:long-poll")).contains("104");
            assertThat(store.pendingUpdate("vk:long-poll")).isPresent();

            assertThat(poller(store, server, http, routed).step(1)).isEqualTo(VkLongPoll.Step.PROCESSED);
            assertThat(routed).containsExactly(event);
        }
    }

    @Test
    void disabledOutgoingEventsAreRejectedBeforeAnIdentityOrCursorIsStored() throws Exception {
        try (var server = new Server(); var http = HttpClient.newHttpClient();
                var store = SqliteTextHandoff.open(directory.resolve("inbox.sqlite"), CLOCK.instant())) {
            server.settings.set("{\"response\":{\"is_enabled\":1,\"events\":{\"message_new\":1,\"message_reply\":0}}}");
            assertThatThrownBy(() -> poller(store, server, http, new ArrayList<>()))
                    .hasMessage("VK Long Poll message_reply event is disabled");
            assertThat(server.keyRequests.get()).isZero();
            assertThat(store.cursor("vk:long-poll")).isEmpty();
            store.saveUpdates("vk:long-poll", List.of(), "104", CLOCK.instant());
            assertThat(store.claimChannelIdentity("vk", "48"))
                    .isEqualTo(SqliteTextHandoff.ChannelIdentity.LEGACY_UNBOUND);
        }
    }

    private static VkLongPoll poller(SqliteTextHandoff store, Server server, HttpClient http, List<String> routed)
            throws Exception {
        var api = new VkApiClient(http, server.origin(), TOKEN, Duration.ofSeconds(3));
        return VkLongPoll.connect(store, api, GROUP, event -> routed.add(event.toString()), CLOCK);
    }

    private static final class Server implements AutoCloseable {
        private final HttpServer server;
        private final AtomicReference<String> form = new AtomicReference<>();
        private final AtomicReference<String> update = new AtomicReference<>();
        private final AtomicReference<String> settings = new AtomicReference<>(
                "{\"response\":{\"is_enabled\":1,\"events\":{\"message_new\":true,\"message_reply\":true}}}");
        private final AtomicInteger keyRequests = new AtomicInteger();
        private final List<String> queries = new CopyOnWriteArrayList<>();

        private Server() throws Exception {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/method/groups.getLongPollSettings", exchange -> {
                try (exchange) {
                    var body = settings.get().getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                }
            });
            server.createContext("/method/groups.getLongPollServer", exchange -> {
                try (exchange) {
                    form.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                    var sequence = keyRequests.incrementAndGet();
                    var body = "{\"response\":{\"key\":\"key+%d\",\"server\":\"%s/check\",\"ts\":%d}}"
                            .formatted(sequence, origin(), sequence * 100).getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                }
            });
            server.createContext("/check", exchange -> {
                try (exchange) {
                    queries.add(exchange.getRequestURI().getRawQuery());
                    var body = update.get().getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, body.length);
                    exchange.getResponseBody().write(body);
                }
            });
            server.start();
        }

        private URI origin() {
            return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
