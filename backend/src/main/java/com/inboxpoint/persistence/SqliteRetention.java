package com.inboxpoint.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;

public final class SqliteRetention {
    private static final String EXPIRED = """
            request.status = 'closed' AND julianday(request.closed_at) <= julianday(?)
            """;

    private static final String BLOCKED = """
            EXISTS (
                SELECT 1 FROM deliveries AS unfinished
                WHERE unfinished.request_id = request.id AND unfinished.status != 'sent'
            )
            """;

    private SqliteRetention() {
    }

    public record Result(int eligibleRequests, int skippedRequests, int messagesDeleted,
            int deliveriesRedacted, int requestsAnonymized) {
    }

    public static Result purge(Connection connection, Instant closedBefore) throws SQLException {
        var cutoff = closedBefore.toString();
        var eligible = EXPIRED + " AND NOT " + BLOCKED;
        var eligibleIds = "SELECT request.id FROM support_requests AS request WHERE " + eligible;
        try (var transaction = connection.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                var eligibleRequests = count(connection, eligible, cutoff);
                var skippedRequests = count(connection, EXPIRED + " AND " + BLOCKED, cutoff);
                var messagesDeleted = update(connection,
                        "DELETE FROM conversation_messages WHERE request_id IN (" + eligibleIds + ")", cutoff);
                var deliveriesRedacted = update(connection, """
                        UPDATE deliveries SET text = '' WHERE status = 'sent' AND text != '' AND request_id IN (
                        """ + eligibleIds + ")", cutoff);
                var requestsAnonymized = update(connection, """
                        UPDATE support_requests AS request SET client_display_name = NULL
                        WHERE client_display_name IS NOT NULL AND
                        """ + eligible, cutoff);
                transaction.execute("COMMIT");
                return new Result(eligibleRequests, skippedRequests, messagesDeleted, deliveriesRedacted, requestsAnonymized);
            } catch (SQLException | RuntimeException failure) {
                try {
                    transaction.execute("ROLLBACK");
                } catch (SQLException rollback) {
                    failure.addSuppressed(rollback);
                }
                throw failure;
            }
        }
    }

    static Optional<Instant> oldestRetainedContent(Connection connection) throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                SELECT MIN(request.closed_at) FROM support_requests AS request
                WHERE request.status = 'closed' AND request.closed_at IS NOT NULL AND NOT
                """ + BLOCKED + """
                AND (request.client_display_name IS NOT NULL OR EXISTS (
                    SELECT 1 FROM conversation_messages AS message WHERE message.request_id = request.id
                ) OR EXISTS (
                    SELECT 1 FROM deliveries AS delivery
                    WHERE delivery.request_id = request.id AND delivery.status = 'sent' AND delivery.text != ''
                ))
                """)) {
            var oldest = rows.next() ? rows.getString(1) : null;
            return oldest == null ? Optional.empty() : Optional.of(Instant.parse(oldest));
        }
    }

    private static int count(Connection connection, String predicate, String cutoff) throws SQLException {
        try (var statement = connection.prepareStatement(
                "SELECT COUNT(*) FROM support_requests AS request WHERE " + predicate)) {
            statement.setString(1, cutoff);
            try (var rows = statement.executeQuery()) {
                return rows.next() ? rows.getInt(1) : 0;
            }
        }
    }

    private static int update(Connection connection, String sql, String cutoff) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            statement.setString(1, cutoff);
            return statement.executeUpdate();
        }
    }
}
