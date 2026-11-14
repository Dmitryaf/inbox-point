package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqliteStartupRecoveryTest {
    private static final Instant NOW = Instant.parse("2026-11-01T10:03:00Z");
    @TempDir
    Path directory;

    @Test
    void releasesAReplyAfterAConfirmedReopenAndDoesSoOnlyOnce() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        try (var connection = SqliteDatabase.openExisting(database)) {
            stageHeldReply(connection, "sent");

            SqliteStartupRecovery.recoverInterruptedWork(connection, NOW);
            SqliteStartupRecovery.recoverInterruptedWork(connection, NOW);

            assertThat(scalar(connection, "SELECT status FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("active");
            assertThat(scalar(connection, "SELECT processing_state FROM conversation_messages WHERE id = 'held-reply'"))
                    .isEqualTo("accepted");
            assertThat(scalar(connection, """
                    SELECT count(*) FROM deliveries WHERE idempotency_key = 'operator:778'
                        AND external_conversation_id = '1234567890123' AND request_id = 'request-1'
                    """)).isEqualTo("1");
        }
    }

    @Test
    void releasesAPreviouslySupersededReplyInItsOriginalRequestWithoutReopeningIt() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        try (var connection = SqliteDatabase.openExisting(database)) {
            stageHeldReply(connection, "superseded");
            createNewGeneration(connection);

            SqliteStartupRecovery.recoverInterruptedWork(connection, NOW);

            assertThat(scalar(connection, "SELECT status FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("closed");
            assertThat(scalar(connection, "SELECT request_id FROM deliveries WHERE idempotency_key = 'operator:778'"))
                    .isEqualTo("request-1");
        }
    }

    @Test
    void manualConfirmationOfAReopenReleasesItsHeldReplyExactlyOnce() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        try (var connection = SqliteDatabase.openExisting(database)) {
            stageHeldReply(connection, "outcome_unknown");
        }
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.resolveTopicAction("reopen-1", true, NOW)).isTrue();
            assertThat(store.resolveTopicAction("reopen-1", true, NOW)).isFalse();
        }
        try (var connection = SqliteDatabase.openExisting(database)) {
            assertThat(scalar(connection, "SELECT count(*) FROM deliveries WHERE idempotency_key = 'operator:778'"))
                    .isEqualTo("1");
            assertThat(scalar(connection, """
                    SELECT manual_resolution FROM operator_actions WHERE id = 'reopen-1' AND status = 'sent'
                    """)).isEqualTo("confirmed_completed");
        }
    }

    @Test
    void refusesToReopenASupersededGenerationAfterAnInconsistentConfirmation() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        try (var connection = SqliteDatabase.openExisting(database)) {
            stageHeldReply(connection, "sent");
            createNewGeneration(connection);

            assertThatThrownBy(() -> SqliteStartupRecovery.recoverInterruptedWork(connection, NOW))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("Completed held operator reply could not be recovered");
            assertThat(scalar(connection, "SELECT processing_state FROM conversation_messages WHERE id = 'held-reply'"))
                    .isEqualTo("held");
            assertThat(scalar(connection, "SELECT COUNT(*) FROM deliveries")).isEqualTo("0");
        }
    }

    private static void stageHeldReply(Connection connection, String status) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE support_requests SET status = 'closed', closed_at = '2026-11-01T10:00:30.000Z'
                    WHERE id = 'request-1'
                    """);
        }
        try (var statement = connection.prepareStatement("""
                INSERT INTO operator_actions
                    (id, request_id, kind, client_message_id, operator_topic_id, sequence, initial, status, created_at)
                VALUES ('reopen-1', 'request-1', 'reopen_request', '778', '501', 0, 0, ?, '2026-11-01T10:01:00.000Z')
                """)) {
            statement.setString(1, status);
            statement.executeUpdate();
        }
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO conversation_messages
                        (id, request_id, direction, external_message_id, text, created_at, processing_state,
                         event_source, external_event_id, prerequisite_action_id, held_sequence)
                    VALUES ('held-reply', 'request-1', 'operator_to_client', '88', 'Synthetic reply',
                            '2026-11-01T10:01:00.000Z', 'held', 'operator:telegram', '778', 'reopen-1', 0)
                    """);
        }
    }

    private static void createNewGeneration(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO support_requests
                        (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                    VALUES ('request-2', 'telegram', '1234567890123', '501', 'active', '2026-11-01T10:02:00.000Z')
                    """);
        }
    }

    private static String scalar(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
