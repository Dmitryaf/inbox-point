package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

import com.inboxpoint.persistence.LegacySqlite;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class TelegramClientMenuTest {
    private static final long OPERATOR = -100123;
    private static final Clock NOW = Clock.fixed(Instant.parse("2026-11-01T10:03:00Z"), ZoneOffset.UTC);
    private static final String CATALOG = """
            {"formatVersion":3,"content":{
              "faq":[{"question":"Что взять?","answer":"Удобную одежду."}],
              "directions":[{"id":"music","name":"Музыка"}],
              "groups":[
                {"id":"open","directionId":"music","name":"Начальная","meetings":["Суббота 10:00"],
                 "description":"","enrollmentOpen":true,"applicationQuestion":"В какой день?",
                 "confirmationText":"Занятие подтверждено!"},
                {"id":"closed","directionId":"music","name":"Старшая","meetings":["Суббота 12:00"],
                 "description":"","enrollmentOpen":false,"applicationQuestion":""}
              ]},"history":[]}
            """;

    @TempDir
    Path directory;

    @Test
    void faqAndTheStaleClosedSignupProduceMenuResponsesWithoutCreatingARequest() throws Exception {
        var database = database();
        var update = new AtomicReference<>(textUpdate(101, 5, "Частые вопросы"));
        try (var server = server(update);
                var client = HttpClient.newHttpClient();
                var runtime = runtime(database, client, server)) {
            run(runtime);
            update.set(callback(102, "classes:signup:closed", 701, 701, "private", 21, null));
            run(runtime);
            assertThat(server.requests()).filteredOn(request -> request.method().equals("sendMessage"))
                    .extracting(request -> request.body().path("text").asString())
                    .satisfiesExactly(text -> assertThat(text).contains("Что взять?", "Удобную одежду."),
                            text -> assertThat(text).contains("Чтобы уточнить запись на занятие"));
            assertThat(server.requests()).filteredOn(request -> request.method().equals("answerCallbackQuery"))
                    .hasSize(1);
            assertThat(scalar(database, "SELECT count(*) FROM support_requests")).isEqualTo("0");
            assertThat(scalar(database, "SELECT count(*) FROM client_conversation_states")).isEqualTo("0");
        }
    }

    @Test
    void durableEnrollmentUsesTheCapturedQuestionContextAndAllowsOneOperatorConfirmation() throws Exception {
        var database = database();
        var update = new AtomicReference<>(callback(101, "classes:signup:open", 701, 701, "private", 21, null));
        try (var server = server(update); var client = HttpClient.newHttpClient()) {
            try (var runtime = runtime(database, client, server)) {
                run(runtime);
            }
            assertThat(scalar(database, "SELECT application_label FROM client_conversation_states"))
                    .isEqualTo("Музыка / Начальная");
            update.set(textUpdate(102, 5, "Могу в субботу"));
            String enrollmentAction;
            try (var runtime = runtime(database, client, server)) {
                run(runtime);
                var relay = server.requests().stream().filter(request ->
                        request.method().equals("sendMessage") && request.body().path("chat_id").asLong() == OPERATOR)
                        .findFirst().orElseThrow();
                assertThat(relay.body().path("text").asString()).contains("Запись на занятие: Музыка / Начальная",
                        "Могу в субботу");
                enrollmentAction = relay.body().at("/reply_markup/inline_keyboard/0/0/callback_data").asString();
                assertThat(enrollmentAction).startsWith("enroll:");
            }
            try (var runtime = runtime(database, client, server)) {
                update.set(callback(103, enrollmentAction, 99, OPERATOR, "supergroup", 78, 42L));
                run(runtime);
                assertThat(scalar(database, "SELECT count(*) FROM deliveries WHERE idempotency_key LIKE 'enrollment:%'"))
                        .isEqualTo("0");
                update.set(callback(104, enrollmentAction, 99, OPERATOR, "supergroup", 77, 42L));
                run(runtime);
                update.set(callback(105, enrollmentAction, 99, OPERATOR, "supergroup", 77, 42L));
                run(runtime);
            }
            assertThat(server.requests()).filteredOn(request -> request.method().equals("sendMessage")
                    && request.body().path("text").asString().equals("Занятие подтверждено!"))
                    .singleElement().satisfies(request -> assertThat(request.body().path("chat_id").asLong())
                            .isEqualTo(701));
            assertThat(scalar(database, "SELECT count(*) FROM deliveries WHERE idempotency_key LIKE 'enrollment:%'"))
                    .isEqualTo("1");
            assertThat(server.requests()).filteredOn(request -> request.method().equals("editMessageReplyMarkup"))
                    .singleElement().satisfies(request ->
                            assertThat(request.body().at("/reply_markup/inline_keyboard/0/0/text").asString())
                                    .isEqualTo("Подтверждение отправлено"));
        }
    }

    private Path database() throws Exception {
        Files.writeString(directory.resolve("content-settings.json"), CATALOG);
        return directory.resolve("fixture.sqlite");
    }

    private static TelegramTextHandoff runtime(Path database, HttpClient client, TelegramTestServer server)
            throws SQLException {
        var api = new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
        return TelegramTextHandoff.open(database, api, OPERATOR, NOW);
    }

    private static void run(TelegramTextHandoff runtime) throws Exception {
        runtime.poll(1);
        while (runtime.processNext()) {
            // Drain the persisted batch before testing the delivery queue.
        }
        runtime.sendPending();
    }

    private static TelegramTestServer server(AtomicReference<String> update) throws Exception {
        return new TelegramTestServer(request -> switch (request.method()) {
            case "getUpdates" -> TelegramTestServer.Response.ok("[" + update.get() + "]");
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
            case "sendMessage" -> TelegramTestServer.Response.message(77);
            case "answerCallbackQuery", "editMessageReplyMarkup" -> TelegramTestServer.Response.ok("true");
            default -> throw new AssertionError("Unexpected Telegram method: " + request.method());
        });
    }

    private static String textUpdate(long updateId, long messageId, String text) {
        return """
                {"update_id":%d,"message":{"message_id":%d,"chat":{"id":701,"type":"private"},
                "from":{"id":701,"first_name":"Synthetic","is_bot":false},"date":1793527320,"text":"%s"}}
                """.formatted(updateId, messageId, text);
    }

    private static String callback(long updateId, String action, long sender, long chat, String type, long messageId,
            Long topic) {
        return """
                {"update_id":%d,"callback_query":{"id":"test-%d","data":"%s","from":{"id":%d,"is_bot":false},
                "message":{"message_id":%d,"chat":{"id":%d,"type":"%s"}%s}}}
                """.formatted(updateId, updateId, action, sender, messageId, chat, type,
                    topic == null ? "" : ",\"message_thread_id\":" + topic);
    }

    private static String scalar(Path database, String sql) throws SQLException {
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
