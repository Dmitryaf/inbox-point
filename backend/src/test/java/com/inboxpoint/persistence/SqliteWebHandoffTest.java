package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static com.inboxpoint.persistence.SqliteTextHandoff.WebActionResult.ACCEPTED;
import static com.inboxpoint.persistence.SqliteTextHandoff.WebActionResult.CLOSED;
import static com.inboxpoint.persistence.SqliteTextHandoff.WebActionResult.NOT_FOUND;
import static org.assertj.core.api.Assertions.assertThat;

class SqliteWebHandoffTest {
    private static final Instant NOW = Instant.parse("2026-11-01T10:01:00Z");

    @TempDir
    Path tempDirectory;

    @Test
    void aBrowserReplyClaimsTheWebRequestAndTreatsSlashCloseAsText() throws Exception {
        var database = fixture();
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.replyFromWeb("web-request", "same-client-key", "/close", NOW)).isEqualTo(ACCEPTED);
            assertThat(store.replyFromWeb("web-request", "same-client-key", "different text", NOW)).isEqualTo(ACCEPTED);
            assertThat(store.pendingTelegramDeliveries(NOW)).singleElement().satisfies(reply -> {
                assertThat(reply.text()).isEqualTo("/close");
                assertThat(reply.conversationId()).isEqualTo("710");
            });
        }
        assertThat(scalar(database, "SELECT web_owned_at FROM support_requests WHERE id = 'web-request'"))
                .isEqualTo("2026-11-01T10:01:00.000Z");
        assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'web-request'")).isEqualTo("active");
        assertThat(scalar(database, """
                SELECT count(*) FROM deliveries WHERE idempotency_key = 'operator:reply:web-request:same-client-key'
                """)).isEqualTo("1");
    }

    @Test
    void resolvingAnUncertainRelayInWebChangesOwnershipAndQueuesOneDelayedAcknowledgement() throws Exception {
        var database = fixture();
        stageUnknownRelay(database);
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.moveOperatorIncidentToWeb("relay", "Delayed acknowledgement", NOW)).isTrue();
            assertThat(store.moveOperatorIncidentToWeb("relay", "Duplicate", NOW)).isFalse();
            assertThat(store.replyFromWeb("request-1", "web-reply", "Continue here", NOW)).isEqualTo(ACCEPTED);
        }
        assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE id = 'request-1'"))
                .isEqualTo("web:request-1");
        assertThat(scalar(database, "SELECT manual_resolution FROM operator_actions WHERE id = 'relay'"))
                .isEqualTo("use_web");
        assertThat(scalar(database, """
                SELECT text FROM deliveries WHERE idempotency_key = 'system:handoff-delayed:request-1'
                """)).isEqualTo("Delayed acknowledgement");
    }

    @Test
    void confirmationOfAllUncertainRelayChunksQueuesOneAcknowledgement() throws Exception {
        var database = fixture();
        stageUnknownRelay(database);
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO operator_actions
                        (id, request_id, kind, client_message_id, operator_topic_id, sequence, initial, status, created_at)
                    VALUES ('relay-part-2', 'request-1', 'relay_message', '23', '501', 1, 1,
                            'outcome_unknown', '2026-11-01T10:00:10.000Z')
                    """);
        }
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.confirmOperatorRelayReceived("relay", "Sent acknowledgement", NOW)).isTrue();
            assertThat(store.pendingTelegramDeliveries(NOW)).isEmpty();
            assertThat(store.confirmOperatorRelayReceived("relay-part-2", "Sent acknowledgement", NOW)).isTrue();
            assertThat(store.confirmOperatorRelayReceived("relay-part-2", "Duplicate", NOW)).isFalse();
        }
        assertThat(scalar(database, """
                SELECT text FROM deliveries WHERE idempotency_key = 'system:handoff-ack:request-1'
                """)).isEqualTo("Sent acknowledgement");
    }

    @Test
    void webActionsRejectTelegramOwnedRequestsAndKeepCloseSeparateFromReply() throws Exception {
        var database = fixture();
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.replyFromWeb("request-1", "reply", "Text", NOW)).isEqualTo(NOT_FOUND);
            assertThat(store.closeFromWeb("request-1", "close", NOW)).isEqualTo(NOT_FOUND);
            assertThat(store.closeFromWeb("web-request", "close", NOW)).isEqualTo(ACCEPTED);
            assertThat(store.closeFromWeb("web-request", "close", NOW)).isEqualTo(ACCEPTED);
            assertThat(store.replyFromWeb("web-request", "late", "Text", NOW)).isEqualTo(CLOSED);
        }
        assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'request-1'")).isEqualTo("active");
        assertThat(scalar(database, "SELECT status FROM support_requests WHERE id = 'web-request'")).isEqualTo("closed");
        assertThat(scalar(database, "SELECT count(*) FROM deliveries")).isEqualTo("0");
    }

    private static void stageUnknownRelay(Path database) throws SQLException {
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO operator_actions
                        (id, request_id, kind, client_message_id, operator_topic_id, sequence, initial, status, created_at)
                    VALUES ('relay', 'request-1', 'relay_message', '23', '501', 0, 1,
                            'outcome_unknown', '2026-11-01T10:00:10.000Z')
                    """);
        }
    }

    private Path fixture() throws Exception {
        var database = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO support_requests
                        (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                    VALUES ('web-request', 'telegram', '710', 'web:web-request', 'active',
                            '2026-11-01T10:00:00.000Z')
                    """);
        }
        return database;
    }

    private static String scalar(Path database, String sql) throws SQLException {
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
