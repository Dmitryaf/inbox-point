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
            assertThat(worker.runOnce()).isEqualTo(2);
            assertThat(worker.runOnce()).isZero();
            assertThat(calls).hasSize(1);
            assertThat(calls.getFirst()).contains("peer_id=123", "message=Answer+to+VK", "random_id=");
            assertThat(bot.requests().stream().filter(call -> call.method().equals("sendMessage")
                    && call.body().path("chat_id").asLong() == 123).toList())
                    .singleElement().satisfies(call -> assertThat(call.body().path("text").asString())
                            .isEqualTo("Answer to Telegram"));
            var backup = directory.resolve("backups/inbox.sqlite");
            store.backup(backup);
            assertThat(Files.exists(backup)).isTrue();
            try (var saved = new TelegramStore(backup)) {
                assertThat(saved.summary().sent()).isEqualTo(2);
            }
        } finally {
            vk.stop(0);
        }
    }

    @Test
    void persistsABatchBeforeDeliveryAndRecoversOnlyIncompleteClaims() throws Exception {
        var database = directory.resolve("inbound.sqlite");
        var event = new VkChannel.Message("vk-batch-1", 123, 456, "Synthetic", "An inbound message");
        var now = java.time.Instant.parse("2026-09-01T08:00:00Z");
        try (var store = new TelegramStore(database)) {
            store.saveVkBatch(java.util.List.of(event, event), now);
            assertThat(store.claim("client:vk", event.event(), now)).isTrue();
            assertThat(store.claim("client:vk", "completed", now)).isTrue();
            store.completeEvent("client:vk", "completed", now);
        }
        try (var restarted = new TelegramStore(database)) {
            restarted.recoverInterrupted();
            assertThat(restarted.nextVk()).isEqualTo(event);
            assertThat(restarted.claim("client:vk", event.event(), now)).isTrue();
            assertThat(restarted.claim("client:vk", "completed", now)).isFalse();
            restarted.completeEvent("client:vk", event.event(), now);
            restarted.deleteVk(event.event());
            assertThat(restarted.nextVk()).isNull();
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
