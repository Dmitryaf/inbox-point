package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;

import com.inboxpoint.content.ClientInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class TelegramTextHandoffTest {
    @TempDir
    Path directory;

    @Test
    void routesTextToTheOperatorsAndAnswersTheSamePrivateChatOnce() throws Exception {
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
            case "sendMessage" -> TelegramTestServer.Response.message(701);
            case "closeForumTopic", "reopenForumTopic" -> TelegramTestServer.Response.ok("true");
            default -> throw new AssertionError("Unexpected method: " + request.method());
        }); var client = HttpClient.newHttpClient();
                var store = new TelegramStore(directory.resolve("telegram.sqlite"))) {
            var api = new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var handoff = new TelegramTextHandoff(-100123, store, api, Clock.systemUTC(),
                    new ClientInformation(directory.resolve("settings.sqlite").toString()));
            var question = update(1, 123, "private", 0, "Question");
            handoff.process(question);
            handoff.process(question);
            handoff.process(update(2, -100999, "supergroup", 42, "Foreign reply"));
            var reply = update(3, -100123, "supergroup", 42, "Answer");
            handoff.process(reply);
            handoff.process(reply);
            new TelegramDeliveryWorker(store, api, Clock.systemUTC()).runOnce();
            handoff.process(update(4, -100123, "supergroup", 42, "/close"));
            handoff.process(update(5, -100123, "supergroup", 42, "Closed reply"));
            assertThat(store.activeRequest(123)).isNull();
            handoff.process(update(6, -100123, "supergroup", 42, "/reopen"));
            assertThat(store.activeRequest(123).topic()).isEqualTo(42);

            var calls = server.requests();
            assertThat(calls).extracting(TelegramTestServer.Request::method)
                    .containsExactly("createForumTopic", "sendMessage", "sendMessage", "closeForumTopic",
                            "reopenForumTopic");
            assertThat(calls.get(1).body().path("chat_id").asLong()).isEqualTo(-100123);
            assertThat(calls.get(1).body().path("message_thread_id").asLong()).isEqualTo(42);
            assertThat(calls.get(1).body().path("text").asString()).contains("Question");
            assertThat(calls.get(2).body().path("chat_id").asLong()).isEqualTo(123);
            assertThat(calls.get(2).body().path("text").asString()).isEqualTo("Answer");
        }
    }

    @Test
    void givesATextOnlyNoticeAndSplitsLongQuestionsOnCodePointBoundaries() throws Exception {
        try (var server = new TelegramTestServer(call -> switch (call.method()) {
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
            case "sendMessage" -> TelegramTestServer.Response.message(101);
            default -> throw new AssertionError("Unexpected method " + call.method());
        }); var http = HttpClient.newHttpClient();
                var store = new TelegramStore(directory.resolve("message.sqlite"))) {
            var api = new TelegramBotApi(http, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var handoff = new TelegramTextHandoff(-100123, store, api, Clock.systemUTC(),
                    new ClientInformation(directory.resolve("settings.sqlite").toString()));
            var unsupported = update(1, 123, "private", 0, "");
            ((tools.jackson.databind.node.ObjectNode) unsupported.path("message")).putArray("photo");
            handoff.process(unsupported);
            assertThat(store.activeRequest(123)).isNull();
            assertThat(server.requests().getFirst().body().path("text").asString()).contains("только текст");
            handoff.process(update(2, 123, "private", 0, "🙂".repeat(5000)));
            var relays = server.requests().stream().filter(call -> call.body().path("message_thread_id").asLong() == 42).toList();
            assertThat(relays).hasSize(2).allSatisfy(call -> {
                var text = call.body().path("text").asString();
                assertThat(text.codePointCount(0, text.length())).isLessThanOrEqualTo(4096);
            });
        }
    }

    private static JsonNode update(long id, long chat, String type, long topic, String text) {
        var root = JsonMapper.shared().createObjectNode().put("update_id", id);
        var message = root.putObject("message").put("message_id", id + 100)
                .put("message_thread_id", topic).put("text", text);
        message.putObject("chat").put("id", chat).put("type", type);
        message.putObject("from").put("is_bot", false).put("first_name", "Synthetic");
        return root;
    }
}
