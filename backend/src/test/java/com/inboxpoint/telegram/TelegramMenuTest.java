package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import com.inboxpoint.content.ClientInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class TelegramMenuTest {
    @TempDir
    Path directory;

    @Test
    void offersPersistentMenuAndMovesACustomerToANewTopicWhenTheOldOneDisappears() throws Exception {
        var topics = new AtomicInteger(40);
        var relays = new AtomicInteger(0);
        try (var server = new TelegramTestServer(call -> switch (call.method()) {
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":" + topics.incrementAndGet() + "}");
            case "closeForumTopic" -> TelegramTestServer.Response.ok("true");
            case "sendMessage" -> {
                if (call.body().path("chat_id").asLong() < 0 && relays.incrementAndGet() == 2) {
                    yield new TelegramTestServer.Response(400,
                            "{\"ok\":false,\"error_code\":400,\"description\":\"Bad Request: message thread not found\"}");
                }
                yield TelegramTestServer.Response.message(77);
            }
            default -> throw new AssertionError("Unexpected API call " + call.method());
        }); var http = HttpClient.newHttpClient();
                var store = new TelegramStore(directory.resolve("menu.sqlite"))) {
            var api = new TelegramBotApi(http, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var handoff = new TelegramTextHandoff(-100123, store, api, Clock.systemUTC(),
                    new ClientInformation(directory.resolve("settings.sqlite").toString()));
            handoff.process(update(1, "/start"));
            handoff.process(update(1, "/start"));
            assertThat(store.activeRequest(123)).isNull();
            assertThat(server.requests()).hasSize(1);
            assertThat(server.requests().getFirst().body().at("/reply_markup/is_persistent").asBoolean()).isTrue();
            handoff.process(update(2, "First question"));
            assertThat(store.activeRequest(123).topic()).isEqualTo("41");
            handoff.process(update(3, "Second message"));
            assertThat(store.activeRequest(123).topic()).isEqualTo("42");
            assertThat(store.byTopic(41).active()).isFalse();
            handoff.process(update(4, "Начать новый вопрос"));
            assertThat(store.activeRequest(123)).isNull();
        }
    }

    private static JsonNode update(long id, String text) {
        var root = JsonMapper.shared().createObjectNode().put("update_id", id);
        var message = root.putObject("message").put("message_id", id).put("text", text);
        message.putObject("chat").put("id", 123).put("type", "private");
        message.putObject("from").put("is_bot", false);
        return root;
    }
}
