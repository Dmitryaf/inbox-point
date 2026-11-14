package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqliteDeliveryQueueTest {
    private static final Instant NOW = Instant.parse("2026-11-01T10:01:00Z");
    private static final Set<String> TELEGRAM = Set.of("telegram");

    @TempDir
    Path tempDirectory;

    private Path database;

    @BeforeEach
    void createLegacyDatabase() throws Exception {
        database = LegacySqlite.createVersion17(tempDirectory);
    }

    @Test
    void repeatedEventKeepsTheFirstDeliveryAndConversationOrder() throws Exception {
        try (var connection = SqliteDatabase.openExisting(database)) {
            var queue = new SqliteDeliveryQueue(connection);
            assertThat(queue.enqueue(delivery("first", "operator:789"))).isEqualTo("first");
            assertThat(queue.enqueue(delivery("duplicate", "operator:789"))).isEqualTo("first");
            queue.enqueue(delivery("second", "operator:790"));

            assertThat(queue.findPending(NOW, 25, Set.of("vk"))).isEmpty();
            assertThat(queue.findPending(NOW, 25, TELEGRAM))
                    .containsExactly(delivery("first", "operator:789"));
            assertThat(queue.claim("first", NOW)).isTrue();
            assertThat(queue.claim("first", NOW)).isFalse();
            assertThat(queue.findPending(NOW, 25, TELEGRAM)).isEmpty();
        }
    }

    @Test
    void interruptedAttemptBecomesUncertainAndIsNeverAutomaticallyResent() throws Exception {
        try (var connection = SqliteDatabase.openExisting(database)) {
            var queue = new SqliteDeliveryQueue(connection);
            queue.enqueue(delivery("interrupted", "operator:789"));
            queue.enqueue(delivery("untouched", "operator:790"));
            assertThat(queue.claim("interrupted", NOW)).isTrue();
        }

        try (var connection = SqliteDatabase.openExisting(database)) {
            SqliteStartupRecovery.recoverInterruptedDeliveries(connection);
            SqliteStartupRecovery.recoverInterruptedDeliveries(connection);
            var queue = new SqliteDeliveryQueue(connection);

            assertThat(queue.findPending(NOW, 25, TELEGRAM))
                    .containsExactly(delivery("untouched", "operator:790"));
            assertThat(queue.claim("interrupted", NOW)).isFalse();
            try (var statement = connection.createStatement();
                    var row = statement.executeQuery("""
                            SELECT status, attempts, outcome_unknown, attempt_started_at
                            FROM deliveries WHERE id = 'interrupted'
                            """)) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("status")).isEqualTo("failed");
                assertThat(row.getInt("attempts")).isEqualTo(1);
                assertThat(row.getInt("outcome_unknown")).isEqualTo(1);
                assertThat(row.getString("attempt_started_at")).isNull();
            }
        }
    }

    @Test
    void requiresAnExplicitResolutionBeforeRetryingAnUncertainDelivery() throws Exception {
        try (var connection = SqliteDatabase.openExisting(database)) {
            var queue = new SqliteDeliveryQueue(connection);
            var original = delivery("reply", "operator:789");
            queue.enqueue(original);
            assertThat(queue.claim("reply", NOW)).isTrue();
            SqliteStartupRecovery.recoverInterruptedDeliveries(connection);

            assertThat(queue.retryFailed("reply", false, NOW)).isFalse();
            assertThat(queue.findPending(NOW, 25, TELEGRAM)).isEmpty();
            assertThat(queue.retryFailed("reply", true, NOW)).isTrue();
            assertThat(queue.retryFailed("reply", true, NOW)).isFalse();
            assertThat(queue.findPending(NOW, 25, TELEGRAM)).containsExactly(original);
        }
    }

    @Test
    void confirmationOfReceiptFinalizesAnUncertainDeliveryWithoutSchedulingIt() throws Exception {
        try (var connection = SqliteDatabase.openExisting(database)) {
            var queue = new SqliteDeliveryQueue(connection);
            queue.enqueue(delivery("reply", "operator:789"));
            assertThat(queue.claim("reply", NOW)).isTrue();
            SqliteStartupRecovery.recoverInterruptedDeliveries(connection);

            assertThat(queue.confirmUnknownReceived("reply", NOW)).isTrue();
            assertThat(queue.confirmUnknownReceived("reply", NOW)).isFalse();
            assertThat(queue.retryFailed("reply", true, NOW)).isFalse();
            assertThat(queue.findPending(NOW, 25, TELEGRAM)).isEmpty();
            try (var statement = connection.createStatement();
                    var row = statement.executeQuery("""
                            SELECT status, manual_resolution, outcome_unknown FROM deliveries WHERE id = 'reply'
                            """)) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("status")).isEqualTo("sent");
                assertThat(row.getString("manual_resolution")).isEqualTo("confirmed_received");
                assertThat(row.getInt("outcome_unknown")).isZero();
            }
        }
    }

    @Test
    void failedLinkInsertRollsBackCompletionAndKeepsTheClaim() throws Exception {
        try (var connection = SqliteDatabase.openExisting(database)) {
            var queue = new SqliteDeliveryQueue(connection);
            queue.enqueue(delivery("reply", "operator:789"));
            assertThat(queue.claim("reply", NOW)).isTrue();
            insertExistingLink(connection);

            assertThatThrownBy(() -> queue.complete("reply", "300", "existing-link", NOW))
                    .isInstanceOf(SQLException.class);

            try (var statement = connection.createStatement();
                    var row = statement.executeQuery("""
                            SELECT status, attempts, external_message_id, attempt_started_at
                            FROM deliveries WHERE id = 'reply'
                            """)) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("status")).isEqualTo("pending");
                assertThat(row.getInt("attempts")).isZero();
                assertThat(row.getString("external_message_id")).isNull();
                assertThat(row.getString("attempt_started_at")).isEqualTo("2026-11-01T10:01:00.000Z");
            }
            queue.complete("reply", "300", "reply-link", NOW);
            try (var statement = connection.createStatement();
                    var row = statement.executeQuery("""
                            SELECT deliveries.status, deliveries.attempts, message_links.client_message_id,
                                   message_links.operator_message_id, message_links.direction
                            FROM deliveries
                            JOIN message_links USING (request_id)
                            WHERE deliveries.id = 'reply' AND message_links.id = 'reply-link'
                            """)) {
                assertThat(row.next()).isTrue();
                assertThat(row.getString("status")).isEqualTo("sent");
                assertThat(row.getInt("attempts")).isEqualTo(1);
                assertThat(row.getString("client_message_id")).isEqualTo("300");
                assertThat(row.getString("operator_message_id")).isEqualTo("789");
                assertThat(row.getString("direction")).isEqualTo("operator_to_client");
            }
        }
    }

    private static SqliteDeliveryQueue.Delivery delivery(String id, String idempotencyKey) {
        return new SqliteDeliveryQueue.Delivery(id, "request-1", idempotencyKey, "789",
                "telegram", "1234567890123", "Test reply", null, NOW);
    }

    private static void insertExistingLink(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    INSERT INTO message_links (id, request_id, direction, client_message_id, operator_message_id, created_at)
                    VALUES ('existing-link', 'request-1', 'client_to_operator', '123', '456', '2026-11-01T10:00:00.000Z')
                    """);
        }
    }
}
