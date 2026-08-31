package com.inboxpoint.telegram;

import java.time.Duration;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TelegramPreflightTest {
    @Test
    void confirmsIdentityForumPermissionsAndPollingModeBeforeRunning() throws Exception {
        try (var server = server("", true)) {
            TelegramRuntime.verifyConnection(server.origin(), TelegramTestServer.TOKEN, -100123);
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method)
                    .containsExactly("getMe", "getChat", "getChatMember", "getWebhookInfo");
        }
    }

    @Test
    void rejectsExistingWebhookAndMissingTopicPermissionBeforePolling() throws Exception {
        try (var server = server("https://example.invalid/telegram", true)) {
            assertThatThrownBy(() -> TelegramRuntime.verifyConnection(server.origin(), TelegramTestServer.TOKEN,
                    -100123)).hasMessageContaining("webhook");
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method).doesNotContain("getUpdates");
        }
        try (var server = server("", false)) {
            assertThatThrownBy(() -> TelegramRuntime.verifyConnection(server.origin(), TelegramTestServer.TOKEN,
                    -100123)).hasMessageContaining("can_manage_topics");
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method)
                    .doesNotContain("getWebhookInfo", "getUpdates");
        }
    }

    private static TelegramTestServer server(String webhook, boolean manageTopics) throws Exception {
        return new TelegramTestServer(request -> TelegramTestServer.Response.ok(switch (request.method()) {
            case "getMe" -> "{\"id\":1,\"is_bot\":true}";
            case "getChat" -> "{\"id\":-100123,\"type\":\"supergroup\",\"is_forum\":true}";
            case "getChatMember" -> "{\"status\":\"administrator\",\"can_manage_topics\":" + manageTopics + "}";
            case "getWebhookInfo" -> "{\"url\":\"" + webhook + "\"}";
            default -> throw new AssertionError("Unexpected method: " + request.method());
        }));
    }
}
