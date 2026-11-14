package com.inboxpoint.operations;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;

import com.inboxpoint.InboxPointApplication;
import com.inboxpoint.persistence.LegacySqlite;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class OperatorInboxEndpointTest {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final String AT = "2026-09-01T12:00:00.000Z";

    @TempDir
    Path directory;

    @Test
    void pagesWebRequestsAndAcceptedHistoryAndUsesTheDurableReplyAndCloseActions() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        seed(database);
        try (var app = new SpringApplicationBuilder(InboxPointApplication.class).run("--server.port=0",
                "--server.address=127.0.0.1", "--spring.main.banner-mode=off", "--DATABASE_PATH=" + database,
                "--INBOXPOINT_ENV=test", "--ADMIN_PASSWORD=", "--VK_ENABLED=false", "--TELEGRAM_ENABLED=false", "--HTTP_TRUSTED_PROXIES=");
                var http = HttpClient.newBuilder().proxy(HttpClient.Builder.NO_PROXY).build()) {
            var base = "http://127.0.0.1:" + app.getEnvironment().getRequiredProperty("local.server.port") + "/api/ops/inbox/requests";
            var requests = send(http, base, null);
            assertThat(requests.statusCode()).isEqualTo(200);
            var page = JSON.readTree(requests.body());
            assertThat(page.path("requests").size()).isEqualTo(50);
            assertThat(page.at("/requests/0/id").asString()).isEqualTo("web-50");
            assertThat(page.at("/requests/49/id").asString()).isEqualTo("web-01");
            var more = JSON.readTree(send(http, base + "?cursor=" + page.path("nextCursor").asString(), null).body());
            assertThat(more.path("requests").size()).isEqualTo(1);
            assertThat(more.at("/requests/0/id").asString()).isEqualTo("web-00");
            assertThat(more.at("/requests/0/latestMessageAt").asString()).isEqualTo(AT);
            assertThat(more.has("nextCursor")).isFalse();
            assertThat(send(http, base + "?cursor=not-a-cursor", null).statusCode()).isEqualTo(400);
            assertThat(send(http, base + "/request-1/messages", null).statusCode()).isEqualTo(404);

            var request = base + "/web-00";
            var messages = JSON.readTree(send(http, request + "/messages", null).body());
            assertThat(messages.path("messages").size()).isEqualTo(200);
            assertThat(messages.at("/messages/0/id").asString()).isEqualTo("message-1");
            assertThat(messages.at("/messages/199/id").asString()).isEqualTo("message-200");
            var older = JSON.readTree(send(http, request + "/messages?cursor=" + messages.path("nextCursor").asString(), null).body());
            assertThat(older.path("messages").size()).isEqualTo(1);
            assertThat(older.at("/messages/0/id").asString()).isEqualTo("message-0");
            assertThat(older.has("nextCursor")).isFalse();

            var reply = "{\"idempotencyKey\":\"same-key\",\"text\":\"  /close  \"}";
            assertThat(send(http, request + "/replies", reply).body()).isEqualTo("{\"queued\":true}");
            assertThat(send(http, request + "/replies", reply).statusCode()).isEqualTo(200);
            var close = "{\"idempotencyKey\":\"close-key\"}";
            assertThat(send(http, request + "/close", close).body()).isEqualTo("{\"closed\":true}");
            assertThat(send(http, request + "/close", close).statusCode()).isEqualTo(200);
            assertThat(send(http, request + "/replies", reply).statusCode()).isEqualTo(409);
            var closed = JSON.readTree(send(http, request + "/messages", null).body());
            assertThat(closed.at("/messages/199/text").asString()).isEqualTo("/close");
            assertThat(closed.at("/messages/199/deliveryStatus").asString()).isEqualTo("pending");
            assertThat(closed.at("/messages/199/deliveryOutcomeUnknown").isBoolean()).isTrue();
            assertThat(closed.at("/messages/198/deliveryStatus").isMissingNode()).isTrue();
        }
    }

    private static void seed(Path database) throws Exception {
        try (var connection = LegacySqlite.connect(database);
                var requests = connection.prepareStatement("""
                        INSERT INTO support_requests (id, channel, external_conversation_id,
                            client_display_name, operator_topic_id, status, created_at)
                        VALUES (?, 'vk', ?, ?, ?, 'active', ?)
                        """); var messages = connection.prepareStatement("""
                        INSERT INTO conversation_messages (id, request_id, direction, external_message_id, text, created_at, processing_state)
                        VALUES (?, 'web-00', 'client_to_operator', ?, ?, ?, ?)
                        """)) {
            for (int i = 0; i <= 50; i++) {
                requests.setString(1, "web-" + (i < 10 ? "0" : "") + i);
                requests.setString(2, Integer.toString(i));
                requests.setString(3, "Клиент " + i);
                requests.setString(4, "web:vk:" + i);
                requests.setString(5, AT);
                requests.addBatch();
            }
            requests.executeBatch();
            for (int i = 0; i <= 201; i++) {
                messages.setString(1, "message-" + i);
                messages.setString(2, Integer.toString(i));
                messages.setString(3, "Сообщение " + i);
                messages.setString(4, AT);
                messages.setString(5, i == 201 ? "held" : "accepted");
                messages.addBatch();
            }
            messages.executeBatch();
        }
    }

    private static HttpResponse<String> send(HttpClient http, String uri, String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(uri));
        if (body != null) {
            request.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
