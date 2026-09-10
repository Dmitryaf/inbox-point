package com.inboxpoint.telegram;

import java.nio.file.Files;
import java.nio.file.Path;

import com.inboxpoint.content.ClientInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TelegramSetupTest {
    @TempDir
    Path directory;

    @Test
    void discoversAForumPersistsConnectionAndStartsItAfterRestart() throws Exception {
        try (var server = new TelegramTestServer(request -> TelegramTestServer.Response.ok(switch (request.method()) {
            case "getUpdates" -> request.body().path("timeout").asInt() == 0
                    ? """
                    [{"message":{"chat":{"id":-100123,"title":"Test forum","type":"supergroup","is_forum":true}}}]
                    """
                    : "[]";
            case "getMe" -> "{\"id\":1,\"is_bot\":true}";
            case "getChat" -> "{\"id\":-100123,\"type\":\"supergroup\",\"is_forum\":true}";
            case "getChatMember" -> "{\"status\":\"administrator\",\"can_manage_topics\":true}";
            case "getWebhookInfo" -> "{\"url\":\"\"}";
            default -> throw new AssertionError("Unexpected method: " + request.method());
        }))) {
            var environment = new MockEnvironment()
                    .withProperty("DATABASE_PATH", directory.resolve("setup.sqlite").toString())
                    .withProperty("inboxpoint.telegram.api-origin", server.origin().toString());
            var runtime = new TelegramRuntime(environment,
                    new ClientInformation(directory.resolve("setup.sqlite").toString()));
            try {
                runtime.start();
                assertThat(runtime.status().connected()).isFalse();
                assertThat(runtime.discover(TelegramTestServer.TOKEN))
                        .containsExactly(new TelegramTextHandoff.OperatorChat(-100123, true, "Test forum", "supergroup"));
                runtime.connect(TelegramTestServer.TOKEN, -100123);
                assertThat(runtime.status()).isEqualTo(new TelegramRuntime.Status(true, true, "local"));
                assertThatThrownBy(() -> runtime.connect(TelegramTestServer.TOKEN, -100123))
                        .hasMessageContaining("already connected");
                var settings = JsonMapper.shared().readTree(Files.readString(directory.resolve("telegram-settings.json")));
                assertThat(settings.path("operatorChatId").asLong()).isEqualTo(-100123);
                assertThat(settings.has("version")).isFalse();
            } finally {
                runtime.stop();
            }
            var restored = new TelegramRuntime(environment,
                    new ClientInformation(directory.resolve("setup.sqlite").toString()));
            try {
                restored.start();
                assertThat(restored.status()).isEqualTo(new TelegramRuntime.Status(true, true, "local"));
                restored.disconnectTelegram();
                restored.disconnectTelegram();
                assertThat(restored.status()).isEqualTo(new TelegramRuntime.Status(false, false, "none"));
                assertThat(Files.exists(directory.resolve("telegram-settings.json"))).isFalse();
            } finally {
                restored.stop();
            }
        }
    }
}
