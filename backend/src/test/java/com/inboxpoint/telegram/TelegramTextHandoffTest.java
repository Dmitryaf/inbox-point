package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import com.inboxpoint.persistence.LegacySqlite;
import com.inboxpoint.persistence.SqliteTextHandoff;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TelegramTextHandoffTest {
    private static final long OPERATOR_CHAT = -100123L;
    private static final long CUSTOMER_CHAT = 701L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-01T10:01:00Z"), ZoneOffset.UTC);

    @TempDir
    Path tempDirectory;

    @Test
    void relaysTheQuestionAndSendsOneReplyToTheOriginalCustomerEvenAfterReplays() throws Exception {
        var database = tempDirectory.resolve("fresh.sqlite");
        var polls = new AtomicInteger();
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> switch (polls.getAndIncrement()) {
                    case 0 -> updates(customerQuestion());
                    case 1 -> updates(operatorReply(105, OPERATOR_CHAT, 42, "Answer"));
                    case 2 -> updates(customerQuestion(), operatorReply(105, OPERATOR_CHAT, 42, "Answer"));
                    default -> updates();
                };
                case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient()) {
            var api = api(client, server);
            try (var runtime = runtime(database, api)) {
                runtime.poll(1);
            }
            assertThat(scalar(database, "SELECT cursor FROM inbound_event_cursors WHERE source = 'telegram:get-updates'"))
                    .isEqualTo("105");
            assertThat(scalar(database, "SELECT COUNT(*) FROM inbound_events")).isEqualTo("1");

            try (var runtime = runtime(database, api)) {
                drainInbound(runtime);
                runtime.sendPending();
                runtime.poll(1);
                drainInbound(runtime);
                runtime.sendPending();
                runtime.poll(1);
                drainInbound(runtime);
                runtime.sendPending();
            }

            assertThat(server.requests()).filteredOn(request -> request.method().equals("createForumTopic")).hasSize(1);
            assertThat(server.requests()).filteredOn(request -> request.method().equals("sendMessage"))
                    .satisfiesExactly(
                            request -> {
                                assertThat(request.body().path("chat_id").asLong()).isEqualTo(OPERATOR_CHAT);
                                assertThat(request.body().path("message_thread_id").asLong()).isEqualTo(42);
                                assertThat(request.body().path("text").asString()).contains("Question for the team");
                            },
                            request -> {
                                assertThat(request.body().path("chat_id").asLong()).isEqualTo(CUSTOMER_CHAT);
                                assertThat(request.body().path("text").asString()).startsWith("Вопрос отправлен.");
                            },
                            request -> {
                                assertThat(request.body().path("chat_id").asLong()).isEqualTo(CUSTOMER_CHAT);
                                assertThat(request.body().has("message_thread_id")).isFalse();
                                assertThat(request.body().path("text").asString()).isEqualTo("Answer");
                            });
            assertThat(scalar(database, "SELECT COUNT(*) FROM support_requests WHERE operator_topic_id = '42'"))
                    .isEqualTo("1");
            assertThat(scalar(database, """
                    SELECT COUNT(*) FROM conversation_messages
                    WHERE external_message_id = '88' AND direction = 'operator_to_client'
                    """)).isEqualTo("1");
            assertThat(scalar(database, """
                    SELECT COUNT(*) FROM deliveries
                    WHERE idempotency_key = 'operator:105' AND status = 'sent'
                    """)).isEqualTo("1");
        }
    }

    @Test
    void persistsEachRelayChunkAndContinuesWhenTheFirstChunkHasAnUnknownOutcome() throws Exception {
        var database = tempDirectory.resolve("fresh.sqlite");
        var sendCalls = new AtomicInteger();
        var question = customerQuestion().replace("Question for the team", "x".repeat(4096));
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> updates(question);
                case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
                case "sendMessage" -> sendCalls.incrementAndGet() == 1
                    ? TelegramTestServer.Response.ok("{}")
                    : TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient();
             var runtime = runtime(database, api(client, server))) {
            runtime.poll(1);
            drainInbound(runtime);
            runtime.sendPending();

            assertThat(sendCalls.get()).isEqualTo(2);
            assertThat(scalar(database, """
                    SELECT status FROM operator_actions WHERE kind = 'relay_message' AND sequence = 0
                    """)).isEqualTo("outcome_unknown");
            assertThat(scalar(database, """
                    SELECT status FROM operator_actions WHERE kind = 'relay_message' AND sequence = 1
                    """)).isEqualTo("sent");
            assertThat(scalar(database, "SELECT count(*) FROM deliveries")).isEqualTo("0");
        }
    }

    @Test
    void doesNotResendAnAcceptedReplyWhenTheLocalCommitFailedAndTheRuntimeRestarts() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = LegacySqlite.connect(database);
                var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TRIGGER fixture_fail_delivery_commit
                    BEFORE UPDATE OF status ON deliveries
                    WHEN NEW.status = 'sent'
                    BEGIN
                        SELECT RAISE(ABORT, 'simulated storage failure');
                    END
                    """);
        }
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> updates(operatorReply(105, OPERATOR_CHAT, 501, "Answer"));
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient()) {
            var api = api(client, server);
            try (var runtime = runtime(database, api)) {
                runtime.poll(1);
                drainInbound(runtime);
                assertThatThrownBy(runtime::sendPending).isInstanceOf(SQLException.class);
            }
            assertThat(scalar(database, """
                    SELECT status FROM deliveries
                    WHERE idempotency_key = 'operator:105' AND attempt_started_at IS NOT NULL
                    """)).isEqualTo("pending");
            try (var runtime = runtime(database, api)) {
                runtime.poll(1);
                drainInbound(runtime);
                runtime.sendPending();
            }
            assertThat(server.requests()).filteredOn(request -> request.method().equals("sendMessage"))
                    .singleElement().satisfies(request ->
                            assertThat(request.body().path("chat_id").asLong()).isEqualTo(1_234_567_890_123L));
            assertThat(scalar(database, """
                    SELECT attempts FROM deliveries
                    WHERE idempotency_key = 'operator:105' AND status = 'failed' AND outcome_unknown = 1
                    """)).isEqualTo("1");
        }
    }

    @Test
    void doesNotSendAReplyReceivedFromAnyOtherGroup() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        try (var server = new TelegramTestServer(request -> updates(operatorReply(105, -100999, 501, "Foreign group")));
                var client = HttpClient.newHttpClient();
                var runtime = runtime(database, api(client, server))) {
            runtime.poll(1);
            drainInbound(runtime);
            runtime.sendPending();

            assertThat(server.requests()).extracting(TelegramTestServer.Request::method).containsExactly("getUpdates");
            assertThat(scalar(database, "SELECT COUNT(*) FROM deliveries")).isEqualTo("0");
        }
    }

    @Test
    void closesAndReopensTheSameRequestUsingDurableOperatorCommands() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        var polls = new AtomicInteger();
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> switch (polls.getAndIncrement()) {
                    case 0 -> updates(operatorReply(105, OPERATOR_CHAT, 501, "/close"));
                    case 1 -> updates(operatorReply(106, OPERATOR_CHAT, 501, "/reopen"));
                    default -> updates(operatorReply(106, OPERATOR_CHAT, 501, "/reopen"));
                };
                case "closeForumTopic", "reopenForumTopic" -> TelegramTestServer.Response.ok("true");
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient();
             var runtime = runtime(database, api(client, server))) {
            runtime.poll(1);
            drainInbound(runtime);
            assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("closed");

            runtime.poll(1);
            drainInbound(runtime);
            runtime.poll(1);
            drainInbound(runtime);
            assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("active");
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method)
                    .containsExactly("getUpdates", "closeForumTopic", "getUpdates", "reopenForumTopic", "getUpdates");
            assertThat(scalar(database, "SELECT count(*) FROM operator_actions WHERE status = 'sent'")).isEqualTo("2");
            assertThat(scalar(database, "SELECT count(*) FROM deliveries")).isEqualTo("0");
        }
    }

    @Test
    void holdsAnOperatorReplyUntilTelegramConfirmsTheReopen() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        var laterClock = Clock.fixed(Instant.parse("2026-11-01T10:03:00Z"), ZoneOffset.UTC);
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE support_requests SET status = 'closed', closed_at = '2026-11-01T10:00:10.000Z'
                    WHERE id = 'request-1'
                    """);
        }
        var polls = new AtomicInteger();
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> polls.getAndIncrement() == 0
                    ? updates(operatorReply(105, OPERATOR_CHAT, 501, "Ответ после закрытия"))
                    : updates("""
                            {"update_id":106,"message":{"message_id":89,"message_thread_id":501,
                             "chat":{"id":-100123,"type":"supergroup"},"date":1793527321,"forum_topic_reopened":{}}}
                            """);
                case "reopenForumTopic" -> TelegramTestServer.Response.ok("{}");
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient()) {
            try (var runtime = TelegramTextHandoff.open(database, api(client, server), OPERATOR_CHAT, laterClock)) {
                runtime.poll(1);
                drainInbound(runtime);
                runtime.sendPending();
            }
            assertThat(scalar(database, "SELECT count(*) FROM deliveries")).isEqualTo("0");
            assertThat(scalar(database, "SELECT processing_state FROM conversation_messages")).isEqualTo("held");
            assertThat(scalar(database, "SELECT status FROM operator_actions WHERE kind = 'reopen_request'"))
                    .isEqualTo("outcome_unknown");
            try (var runtime = TelegramTextHandoff.open(database, api(client, server), OPERATOR_CHAT, laterClock)) {
                runtime.poll(1);
                drainInbound(runtime);
                runtime.sendPending();
            }
            assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("active");
            assertThat(scalar(database, "SELECT processing_state FROM conversation_messages")).isEqualTo("accepted");
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method)
                    .containsExactly("getUpdates", "reopenForumTopic", "getUpdates", "sendMessage");
        }
    }

    @Test
    void explicitConfirmationOfAnUnsuccessfulReopenAllowsOneManualRetry() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        var laterClock = Clock.fixed(Instant.parse("2026-11-01T10:03:00Z"), ZoneOffset.UTC);
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE support_requests SET status = 'closed', closed_at = '2026-11-01T10:00:10.000Z'
                    WHERE id = 'request-1'
                    """);
        }
        var reopens = new AtomicInteger();
        var actionId = "operator-reopen:request-1:105";
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> updates(operatorReply(105, OPERATOR_CHAT, 501, "Held response"));
                case "reopenForumTopic" -> TelegramTestServer.Response.ok(
                        reopens.incrementAndGet() == 1 ? "{}" : "true");
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient()) {
            var api = api(client, server);
            try (var runtime = TelegramTextHandoff.open(database, api, OPERATOR_CHAT, laterClock)) {
                runtime.poll(1);
                drainInbound(runtime);
                assertThat(runtime.retryHeldOperatorReply(actionId)).isFalse();
            }
            try (var store = SqliteTextHandoff.open(database, laterClock.instant())) {
                assertThat(store.resolveTopicAction(actionId, false, laterClock.instant())).isTrue();
            }
            try (var runtime = TelegramTextHandoff.open(database, api, OPERATOR_CHAT, laterClock)) {
                assertThat(runtime.retryHeldOperatorReply(actionId)).isTrue();
                assertThat(runtime.retryHeldOperatorReply(actionId)).isFalse();
                runtime.sendPending();
            }
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method)
                    .containsExactly("getUpdates", "reopenForumTopic", "reopenForumTopic", "sendMessage");
            assertThat(scalar(database, """
                    SELECT COUNT(*) FROM deliveries WHERE idempotency_key = 'operator:105' AND status = 'sent'
                    """)).isEqualTo("1");
        }
    }

    @Test
    void delayedCloseStaysBoundToTheOldGenerationOfAReusedTopic() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        reuseTopic(database);
        try (var server = new TelegramTestServer(request -> updates(operatorReply(105, OPERATOR_CHAT, 501, "/close")));
                var client = HttpClient.newHttpClient();
                var runtime = runtime(database, api(client, server))) {
            runtime.poll(1);
            drainInbound(runtime);

            assertThat(server.requests()).extracting(TelegramTestServer.Request::method).containsExactly("getUpdates");
            assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'request-2'"))
                    .isEqualTo("active");
            assertThat(scalar(database, """
                    SELECT request_id FROM operator_event_bindings
                    WHERE source = 'operator:telegram' AND external_event_id = '105'
                    """)).isEqualTo("request-1");
        }
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void createsANewGenerationOnlyAfterIntakeAndReplacesTheOldTopicOnlyIfItIsMissing(boolean missing)
            throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE support_requests SET status = 'closed', closed_at = '2026-11-01T10:00:10.000Z'
                    WHERE id = 'request-1'
                    """);
        }
        var polls = new AtomicInteger();
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> switch (polls.getAndIncrement()) {
                    case 0 -> updates(customerQuestion(104, 1_234_567_890_123L, 5));
                    case 1 -> updates(customerQuestion(105, 1_234_567_890_123L, 6)
                            .replace("Question for the team", "Задать вопрос"));
                    default -> updates(customerQuestion(106, 1_234_567_890_123L, 7));
                };
                case "reopenForumTopic" -> missing
                        ? new TelegramTestServer.Response(400,
                                "{\"ok\":false,\"error_code\":400,\"description\":\"message thread not found\"}")
                        : TelegramTestServer.Response.ok("true");
                case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient();
             var runtime = runtime(database, api(client, server))) {
            runtime.poll(1);
            drainInbound(runtime);
            assertThat(scalar(database, "SELECT count(*) FROM support_requests")).isEqualTo("1");
            assertThat(server.requests().getLast().body().path("text").asString())
                    .startsWith("Предыдущий разговор завершён.");
            runtime.poll(1);
            drainInbound(runtime);
            assertThat(scalar(database, "SELECT count(*) FROM client_conversation_states")).isEqualTo("1");
            runtime.poll(1);
            drainInbound(runtime);
            runtime.sendPending();

            assertThat(scalar(database, "SELECT count(*) FROM support_requests")).isEqualTo("2");
            assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE status = 'active'"))
                    .isEqualTo(missing ? "42" : "501");
            assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("closed");
            assertThat(scalar(database, "SELECT count(*) FROM client_conversation_states")).isEqualTo("0");
            var expected = missing
                    ? new String[] {"getUpdates", "sendMessage", "getUpdates", "sendMessage", "getUpdates",
                        "reopenForumTopic", "createForumTopic", "sendMessage", "sendMessage"}
                    : new String[] {"getUpdates", "sendMessage", "getUpdates", "sendMessage", "getUpdates",
                        "reopenForumTopic", "sendMessage", "sendMessage"};
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method).containsExactly(expected);
        }
    }

    @Test
    void aLateReplyRemainsBoundToItsClosedRequestWhenTheTopicWasReused() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        reuseTopic(database);
        try (var server = new TelegramTestServer(request -> updates(operatorReply(105, OPERATOR_CHAT, 501, "Late")));
                var client = HttpClient.newHttpClient();
                var runtime = runtime(database, api(client, server))) {
            runtime.poll(1);
            drainInbound(runtime);
            runtime.sendPending();

            assertThat(server.requests()).extracting(TelegramTestServer.Request::method).containsExactly("getUpdates");
            assertThat(scalar(database, """
                    SELECT request_id FROM operator_event_bindings
                    WHERE source = 'operator:telegram' AND external_event_id = '105'
                    """)).isEqualTo("request-1");
            assertThat(scalar(database, "SELECT status FROM inbound_events WHERE external_event_id = '105'"))
                    .isEqualTo("quarantined");
        }
    }

    private static void reuseTopic(Path database) throws SQLException {
        try (var connection = LegacySqlite.connect(database);
                var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE support_requests SET status = 'closed', closed_at = '2026-11-01T10:01:00.000Z'
                    WHERE id = 'request-1'
                    """);
            statement.executeUpdate("""
                    INSERT INTO support_requests
                        (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                    VALUES ('request-2', 'telegram', '1234567890123', '501', 'active', '2026-11-01T10:01:30.000Z')
                    """);
            statement.executeUpdate("""
                    INSERT INTO operator_actions
                        (id, request_id, kind, client_message_id, operator_topic_id, sequence, initial, status,
                         created_at, external_result_id)
                    VALUES ('relay-2', 'request-2', 'relay_message', '33', '501', 0, 1, 'sent',
                            '2026-11-01T10:01:30.000Z', '110')
                    """);
        }
    }

    @Test
    void anAcceptedTopicIsNotRecreatedIfSavingItFailedBeforeRestart() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = LegacySqlite.connect(database);
                var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TRIGGER fixture_fail_topic_commit
                    BEFORE UPDATE OF operator_topic_id ON support_requests
                    WHEN NEW.operator_topic_id = '42'
                    BEGIN
                        SELECT RAISE(ABORT, 'simulated storage failure');
                    END
                    """);
        }
        try (var server = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> updates(customerQuestion());
                case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError("Unexpected Telegram call: " + request.method());
             });
             var client = HttpClient.newHttpClient()) {
            var api = api(client, server);
            try (var runtime = runtime(database, api)) {
                runtime.poll(1);
                assertThatThrownBy(runtime::processNext).isInstanceOf(SQLException.class);
            }
            try (var runtime = runtime(database, api)) {
                drainInbound(runtime);
                runtime.sendPending();
            }
            assertThat(server.requests()).extracting(TelegramTestServer.Request::method)
                    .containsExactly("getUpdates", "createForumTopic", "sendMessage");
            var confirmation = server.requests().getLast().body();
            assertThat(confirmation.path("chat_id").asLong()).isEqualTo(CUSTOMER_CHAT);
            assertThat(confirmation.path("text").asString()).startsWith("Ваш вопрос сохранён.");
            assertThat(scalar(database, "SELECT status FROM operator_actions WHERE kind = 'open_request'"))
                    .isEqualTo("outcome_unknown");
            assertThat(scalar(database, "SELECT count(*) FROM inbound_events WHERE external_event_id = '104'"))
                    .isEqualTo("0");
        }
    }

    private static TelegramTestServer.Response updates(String... updates) {
        return TelegramTestServer.Response.ok("[" + String.join(",", updates) + "]");
    }

    private static String customerQuestion() {
        return customerQuestion(104, CUSTOMER_CHAT, 5);
    }

    private static String customerQuestion(long updateId, long chatId, long messageId) {
        return """
                {"update_id":%d,"message":{"message_id":%d,"chat":{"id":%d,"type":"private"},
                "from":{"id":%d,"first_name":"Synthetic","is_bot":false},
                "date":1793527250,"text":"Question for the team"}}
                """.formatted(updateId, messageId, chatId, chatId);
    }

    private static String operatorReply(int updateId, long chatId, long topicId, String text) {
        return """
                {"update_id":%d,"message":{"message_id":88,"message_thread_id":%d,
                "chat":{"id":%d,"type":"supergroup"},"from":{"id":99,"first_name":"Operator","is_bot":false},
                "date":1793527320,"text":"%s"}}
                """.formatted(updateId, topicId, chatId, text);
    }

    private static void drainInbound(TelegramTextHandoff runtime) throws Exception {
        for (var i = 0; i < 10; i++) {
            if (!runtime.processNext()) {
                return;
            }
        }
        throw new AssertionError("Inbound queue did not drain");
    }

    private static TelegramTextHandoff runtime(Path database, TelegramBotApi api) throws SQLException {
        return TelegramTextHandoff.open(database, api, OPERATOR_CHAT, CLOCK);
    }

    private static TelegramBotApi api(HttpClient client, TelegramTestServer server) {
        return new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
    }

    private static String scalar(Path database, String sql) throws SQLException {
        try (var connection = LegacySqlite.connect(database);
                var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
