package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TelegramBotApiTest {
    @ParameterizedTest
    @CsvSource({
            "getChat, '{\"id\":-100123,\"type\":\"supergroup\",\"is_forum\":false}', Topics enabled",
            "getChatMember, '{\"status\":\"member\"}', administrator",
            "getChatMember, '{\"status\":\"administrator\",\"can_manage_topics\":false}', can_manage_topics",
            "getWebhookInfo, '{\"url\":\"https://example.invalid/fixture\"}', webhook must be removed"
    })
    void rejectsInvalidSetupBeforeAnyPolling(String method, String failure, String reason) throws Exception {
        try (var server = new TelegramTestServer(request -> TelegramTestServer.Response.ok(
                    request.method().equals(method) ? failure : switch (request.method()) {
                        case "getMe" -> "{\"id\":501,\"is_bot\":true}";
                        case "getChat" -> "{\"id\":-100123,\"type\":\"supergroup\",\"is_forum\":true}";
                        case "getChatMember" -> "{\"status\":\"administrator\",\"can_manage_topics\":true}";
                        case "getWebhookInfo" -> "{\"url\":\"\"}";
                        default -> throw new AssertionError(request.method());
                    })); var client = HttpClient.newHttpClient()) {
            assertThatThrownBy(() -> api(client, server).verifySetup(-100123))
                    .isInstanceOf(TelegramBotApi.RequestFailed.class).hasMessageContaining(reason)
                    .hasMessageNotContaining("example.invalid").hasMessageNotContaining(TelegramTestServer.TOKEN);
            assertThat(server.requests().getLast().method()).isEqualTo(method);
        }
    }

    @Test
    void sendsTextToTheExplicitForumTopicAndReturnsThePlatformId() throws Exception {
        try (var server = new TelegramTestServer(request -> TelegramTestServer.Response.message(77));
                var client = HttpClient.newHttpClient()) {
            var api = api(client, server);

            assertThat(api.sendMessage(-100123L, 42L, "Question")).isEqualTo(77);
            assertThat(server.requests()).singleElement().satisfies(request -> {
                assertThat(request.verb()).isEqualTo("POST");
                assertThat(request.method()).isEqualTo("sendMessage");
                assertThat(request.body().path("chat_id").asLong()).isEqualTo(-100123L);
                assertThat(request.body().path("message_thread_id").asLong()).isEqualTo(42);
                assertThat(request.body().path("text").asString()).isEqualTo("Question");
            });
        }
    }

    @Test
    void passesTheSavedOffsetWhenPollingAndKeepsTheUpdatePayload() throws Exception {
        try (var server = new TelegramTestServer(request -> TelegramTestServer.Response.ok("[{\"update_id\":23}]"));
                var client = HttpClient.newHttpClient()) {
            var updates = api(client, server).getUpdates(23L, 1);

            assertThat(updates).singleElement().satisfies(update ->
                    assertThat(update.path("update_id").asLong()).isEqualTo(23));
            assertThat(server.requests()).singleElement().satisfies(request -> {
                assertThat(request.method()).isEqualTo("getUpdates");
                assertThat(request.body().path("offset").asLong()).isEqualTo(23);
                assertThat(request.body().path("timeout").asInt()).isEqualTo(1);
            });
        }
    }

    @Test
    void treatsAnUnusableSuccessAsUncertainAndDoesNotExposeTheResponse() throws Exception {
        try (var server = new TelegramTestServer(request -> TelegramTestServer.Response.ok("{\"text\":\"private body\"}"));
                var client = HttpClient.newHttpClient()) {
            assertThatThrownBy(() -> api(client, server).sendMessage(321, null, "Test"))
                    .isInstanceOfSatisfying(TelegramBotApi.RequestFailed.class, failure -> {
                        assertThat(failure.outcomeUnknown()).isTrue();
                        assertThat(failure.getMessage()).doesNotContain("private body", TelegramTestServer.TOKEN);
                    });
            assertThat(server.requests()).hasSize(1);
        }
    }

    @Test
    void distinguishesAnExplicitRejectionFromAnUncertainResult() throws Exception {
        try (var server = new TelegramTestServer(request ->
                new TelegramTestServer.Response(400, "{\"ok\":false,\"error_code\":400,\"description\":\"private body\"}"));
                var client = HttpClient.newHttpClient()) {
            assertThatThrownBy(() -> api(client, server).createForumTopic(-100123, "Test"))
                    .isInstanceOfSatisfying(TelegramBotApi.RequestFailed.class, failure -> {
                        assertThat(failure.outcomeUnknown()).isFalse();
                        assertThat(failure.getMessage()).doesNotContain("private body");
                        var diagnostic = JsonMapper.shared().valueToTree(failure.diagnostic());
                        assertThat(diagnostic.path("kind").asString()).isEqualTo("api");
                        assertThat(diagnostic.path("method").asString()).isEqualTo("createForumTopic");
                        assertThat(diagnostic.path("apiCode").asInt()).isEqualTo(400);
                        assertThat(diagnostic.toString()).doesNotContain("private body", TelegramTestServer.TOKEN);
                    });
        }
    }

    private static TelegramBotApi api(HttpClient client, TelegramTestServer server) {
        return new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
    }
}
