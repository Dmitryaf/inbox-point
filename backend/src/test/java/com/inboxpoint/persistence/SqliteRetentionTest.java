package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqliteRetentionTest {
    private static final Instant CUTOFF = Instant.parse("2026-11-02T10:00:00Z");

    @TempDir
    Path tempDirectory;

    @Test
    void cleansOnlyExpiredRequestsWithoutUnfinishedDeliveriesOrHeldReplies() throws Exception {
        try (var connection = fixture()) {
            assertThat(SqliteRetention.purge(connection, CUTOFF)).isEqualTo(new SqliteRetention.Result(1, 2, 1, 1, 1));
            assertThat(scalar(connection, "SELECT count(*) FROM conversation_messages")).isEqualTo("3");
            assertThat(scalar(connection, "SELECT count(*) FROM support_requests")).isEqualTo("4");
            assertThat(scalar(connection, "SELECT operator_topic_id FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("501");
            assertThat(scalar(connection, "SELECT text FROM deliveries WHERE id = 'sent'")).isEmpty();
            assertThat(scalar(connection, "SELECT text FROM deliveries WHERE id = 'unknown'")).isEqualTo("Synthetic");
            assertThat(SqliteRetention.purge(connection, CUTOFF)).isEqualTo(new SqliteRetention.Result(1, 2, 0, 0, 0));
        }
    }

    @Test
    void rollsBackTheWholeCleanupWhenRedactingAnOutboundMessageFails() throws Exception {
        try (var connection = fixture(); var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TRIGGER fixture_reject_redaction BEFORE UPDATE OF text ON deliveries
                    BEGIN
                        SELECT RAISE(ABORT, 'synthetic retention failure');
                    END
                    """);

            assertThatThrownBy(() -> SqliteRetention.purge(connection, CUTOFF)).isInstanceOf(SQLException.class);
            assertThat(scalar(connection, "SELECT count(*) FROM conversation_messages")).isEqualTo("4");
            assertThat(scalar(connection, "SELECT client_display_name FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("Synthetic");
        }
    }

    private Connection fixture() throws Exception {
        var connection = SqliteDatabase.openExisting(LegacySqlite.createVersion17(tempDirectory));
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE support_requests SET status = 'closed', closed_at = '2026-11-01T10:02:00.000Z',
                        client_display_name = 'Synthetic' WHERE id = 'request-1';
                    INSERT INTO support_requests
                        (id, channel, external_conversation_id, client_display_name, operator_topic_id, status,
                         created_at, closed_at)
                    VALUES ('keep-unknown', 'telegram', '601', 'Synthetic', '602', 'closed',
                                '2026-11-01T10:00:00.000Z', '2026-11-01T10:02:00.000Z'),
                           ('keep-held', 'telegram', '701', 'Synthetic', '702', 'closed',
                                '2026-11-01T10:00:00.000Z', '2026-11-01T10:02:00.000Z'),
                           ('keep-active', 'vk', '801', 'Synthetic', '802', 'active',
                                '2026-11-01T10:00:00.000Z', NULL);
                    INSERT INTO conversation_messages
                        (id, request_id, direction, external_message_id, text, created_at, processing_state)
                    SELECT 'message-' || id, id, 'operator_to_client', '123', 'Synthetic', created_at,
                        CASE WHEN id = 'keep-held' THEN 'held' ELSE 'accepted' END
                    FROM support_requests;
                    INSERT INTO deliveries (id, request_id, idempotency_key, channel, external_conversation_id, text,
                                            status, created_at, outcome_unknown)
                    VALUES ('sent', 'request-1', 'operator:1', 'telegram', '1234567890123', 'Synthetic',
                                'sent', '2026-11-01T10:00:00.000Z', 0),
                           ('unknown', 'keep-unknown', 'operator:2', 'telegram', '601', 'Synthetic',
                                'failed', '2026-11-01T10:00:00.000Z', 1);
                    """);
            return connection;
        } catch (SQLException failure) {
            connection.close();
            throw failure;
        }
    }

    private static String scalar(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
