package com.inboxpoint.telegram;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import com.inboxpoint.vk.VkChannel;
import com.sun.net.httpserver.HttpServer;
import com.inboxpoint.content.ClientInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class VkBridgeTest {
    @TempDir
    Path directory;

    @Test
    void answersPublishedQuestionsDuringThePauseWithoutOfferingNewRequests() throws Exception {
        var calls = new ArrayList<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/method/messages.send", exchange -> {
            try (exchange) {
                calls.add(java.net.URLDecoder.decode(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8),
                        StandardCharsets.UTF_8));
                var body = "{\"response\":401}".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        server.start();
        var database = directory.resolve("pause.sqlite");
        var information = new ClientInformation(database.toString());
        information.save(JsonMapper.shared().createObjectNode().put("schedule", "Понедельник, 18:00"));
        try (var store = new TelegramStore(database);
                var community = new VkChannel(URI.create("http://127.0.0.1:" + server.getAddress().getPort()),
                        "synthetic-vk-test-token")) {
            var menu = new VkClientMenu(information, community, channel -> true);
            assertThat(menu.handle(store, "pause", 123, "New question")).isTrue();
            var label = information.informationButtons().getFirst();
            assertThat(menu.handle(store, "information", 123, label)).isTrue();
            assertThat(calls).hasSize(2).anySatisfy(call -> assertThat(call)
                    .contains("message=" + information.resolve(label)).doesNotContain(ClientInformation.ASK));
            store.open(new TelegramStore.Request("active", 123, 42, true, "vk"), java.time.Instant.now());
            assertThat(menu.handle(store, "active", 123, "Follow-up")).isFalse();
        } finally {
            server.stop(0);
        }
    }

    @Test
    void keepsTheSameCustomerNumberSeparateAndReturnsRepliesToTheirOriginalChannels() throws Exception {
        var calls = new ArrayList<String>();
        var vk = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        vk.createContext("/method/messages.send", exchange -> {
            try (exchange) {
                calls.add(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                var body = "{\"response\":401}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        vk.start();
        var topics = new AtomicInteger(40);
        try (var bot = new TelegramTestServer(call -> switch (call.method()) {
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":" + topics.incrementAndGet() + "}");
            case "sendMessage" -> TelegramTestServer.Response.message(402);
            default -> throw new AssertionError("Unexpected call " + call.method());
        }); var http = HttpClient.newHttpClient();
                var community = new VkChannel(URI.create("http://127.0.0.1:" + vk.getAddress().getPort()),
                        "synthetic-vk-test-token");
                var store = new TelegramStore(directory.resolve("channels.sqlite"))) {
            var api = new TelegramBotApi(http, bot.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var handoff = new TelegramTextHandoff(-100123, store, api, Clock.systemUTC(),
                    new ClientInformation(directory.resolve("settings.sqlite").toString()));
            handoff.processVk("vk-1", 123, 22, "VK customer", "Question in VK");
            handoff.processVk("vk-1", 123, 22, "VK customer", "Question in VK");
            handoff.process(update(1, 123, 0, "Question in Telegram"));
            assertThat(store.activeRequest("vk", 123).topic()).isEqualTo("41");
            assertThat(store.activeRequest("telegram", 123).topic()).isEqualTo("42");
            handoff.process(update(2, -100123, 41, "Answer to VK"));
            handoff.process(update(3, -100123, 42, "Answer to Telegram"));
            var worker = new TelegramDeliveryWorker(store, api, Clock.systemUTC(), () -> community);
            assertThat(worker.runOnce()).isEqualTo(4);
            assertThat(worker.runOnce()).isZero();
            assertThat(calls).hasSize(2).anySatisfy(call -> assertThat(call).contains("peer_id=123", "message=Answer+to+VK", "random_id="));
            assertThat(bot.requests().stream().filter(call -> call.method().equals("sendMessage")
                    && call.body().path("chat_id").asLong() == 123).toList())
                    .extracting(call -> call.body().path("text").asString())
                    .containsExactlyInAnyOrder("Answer to Telegram", HandoffService.ACKNOWLEDGEMENT);
            var backup = directory.resolve("backups/inbox.sqlite");
            store.backup(backup);
            assertThat(Files.exists(backup)).isTrue();
            try (var saved = new TelegramStore(backup)) {
                assertThat(saved.summary().sent()).isEqualTo(4);
            }
        } finally {
            vk.stop(0);
        }
    }

    @Test
    void persistsABatchBeforeDeliveryAndRecoversOnlyIncompleteClaims() throws Exception {
        var database = directory.resolve("inbound.sqlite");
        var message = new VkChannel.Message("vk-batch-1", 123, 456, "Synthetic", "An inbound message");
        var event = new VkChannel.Inbound(message.event(), JsonMapper.shared().valueToTree(message).toString());
        var now = java.time.Instant.parse("2026-09-01T08:00:00Z");
        try (var store = new TelegramStore(database)) {
            store.saveVkBatch(java.util.List.of(event, event), now);
            assertThat(store.claim("client:vk", event.event(), now)).isTrue();
            assertThat(store.claim("client:vk", "completed", now)).isTrue();
            store.completeEvent("client:vk", "completed", now);
        }
        try (var restarted = new TelegramStore(database)) {
            restarted.recoverInterrupted();
            assertThat(restarted.nextVk().event()).isEqualTo(event);
            assertThat(restarted.claim("client:vk", event.event(), now)).isTrue();
            assertThat(restarted.claim("client:vk", "completed", now)).isFalse();
            restarted.completeEvent("client:vk", event.event(), now);
            restarted.deleteVk(event.event());
            assertThat(restarted.nextVk()).isNull();
        }
    }

    @Test
    void resumesTelegramCursorAndSkipsQuarantinedUpdates() throws Exception {
        var database = directory.resolve("telegram-ingress.sqlite");
        var now = java.time.Instant.parse("2026-09-16T10:00:00Z");
        var mapper = JsonMapper.shared();
        try (var store = new TelegramStore(database)) {
            assertThat(store.telegramOffset()).isNull();
            store.saveTelegramBatch(java.util.List.of(mapper.readTree("{\"update_id\":84}"),
                    mapper.readTree("{\"update_id\":85}")), now);
        }
        try (var store = new TelegramStore(database)) {
            assertThat(store.telegramOffset()).isEqualTo(86L);
            assertThat(store.nextTelegram().event()).isEqualTo("84");
            for (int attempt = 0; attempt < 3; attempt++) {
                store.failTelegram("84", now.plusSeconds(1));
            }
            assertThat(store.nextTelegram().event()).isEqualTo("85");
            assertThat(store.inboundStatus().incidents()).singleElement().satisfies(incident -> {
                assertThat(incident.channel()).isEqualTo("Telegram");
                assertThat(incident.attempts()).isEqualTo(3);
            });
            assertThat(store.resolveInbound("telegram:get-updates", "84", true)).isTrue();
            assertThat(store.nextTelegram().event()).isEqualTo("84");
        }
    }

    @Test
    void quarantinesAnEventAfterThreeAttemptsAndLetsTheNextOneProceed() throws Exception {
        var database = directory.resolve("quarantine.sqlite");
        var now = java.time.Instant.parse("2026-09-11T10:00:00Z");
        try (var store = new TelegramStore(database)) {
            store.saveVkBatch(java.util.List.of(new VkChannel.Inbound("broken", "{}"),
                    new VkChannel.Inbound("next", "{}")), now);
            assertThat(store.nextVk().event().event()).isEqualTo("broken");
            store.failVk("broken", now.plusSeconds(1));
            assertThat(store.nextVk().nextAttemptAt()).isEqualTo(now.plusSeconds(1));
            store.failVk("broken", now.plusSeconds(2));
            store.failVk("broken", now.plusSeconds(3));
            assertThat(store.inboundStatus().quarantined()).isEqualTo(1);
            assertThat(store.nextVk().event().event()).isEqualTo("next");
            assertThat(store.resolveInbound("broken", true)).isTrue();
            assertThat(store.inboundStatus().incidents()).isEmpty();
            assertThat(store.nextVk().event().event()).isEqualTo("broken");
            assertThat(store.resolveInbound("broken", false)).isFalse();
        }
    }

    private static JsonNode update(long id, long chat, long topic, String text) {
        var root = JsonMapper.shared().createObjectNode().put("update_id", id);
        var message = root.putObject("message").put("message_id", id).put("text", text).put("message_thread_id", topic);
        message.putObject("chat").put("id", chat).put("type", chat < 0 ? "supergroup" : "private");
        message.putObject("from").put("is_bot", false).put("first_name", "Synthetic");
        return root;
    }
}
