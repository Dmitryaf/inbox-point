package com.inboxpoint.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

final class SqliteInboundEvents {
    record Event(String externalId, String payload, Instant receivedAt) {
    }

    record Pending(String externalId, String payload, Instant retryAt) {
    }

    private final Connection connection;

    SqliteInboundEvents(Connection connection) {
        this.connection = connection;
    }

    void acceptBatch(String source, List<Event> events, String nextCursor) throws SQLException {
        SqliteDatabase.writeTransaction(connection, () -> {
            insertEvents(source, events);
            saveCursor(source, nextCursor);
        });
    }

    Optional<String> cursor(String source) throws SQLException {
        try (var query = connection.prepareStatement("SELECT cursor FROM inbound_event_cursors WHERE source = ?")) {
            query.setString(1, source);
            try (var rows = query.executeQuery()) {
                return rows.next() ? Optional.of(rows.getString("cursor")) : Optional.empty();
            }
        }
    }

    Optional<Pending> firstPending(String source) throws SQLException {
        try (var query = connection.prepareStatement("""
                SELECT external_event_id, payload, next_attempt_at FROM inbound_events
                WHERE source = ? AND status = 'pending' ORDER BY received_at, rowid LIMIT 1
                """)) {
            query.setString(1, source);
            try (var rows = query.executeQuery()) {
                if (!rows.next()) {
                    return Optional.empty();
                }
                var retryAt = rows.getString("next_attempt_at");
                return Optional.of(new Pending(rows.getString("external_event_id"), rows.getString("payload"),
                        retryAt == null ? null : Instant.parse(retryAt)));
            }
        }
    }

    void complete(String source, String externalId) throws SQLException {
        try (var statement = connection.prepareStatement("""
                DELETE FROM inbound_events WHERE source = ? AND external_event_id = ?
                """)) {
            statement.setString(1, source);
            statement.setString(2, externalId);
            statement.executeUpdate();
        }
    }

    void fail(String source, String externalId, String reason, Instant retryAt, int maxAttempts)
            throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE inbound_events SET attempts = attempts + 1, last_error = ?,
                    status = CASE WHEN attempts + 1 >= ? THEN 'quarantined' ELSE 'pending' END,
                    next_attempt_at = CASE WHEN attempts + 1 >= ? THEN NULL ELSE ? END
                WHERE source = ? AND external_event_id = ? AND status = 'pending'
                """)) {
            statement.setString(1, reason);
            statement.setInt(2, maxAttempts);
            statement.setInt(3, maxAttempts);
            statement.setString(4, SqliteDatabase.timestamp(retryAt));
            statement.setString(5, source);
            statement.setString(6, externalId);
            statement.executeUpdate();
        }
    }

    boolean resolve(String source, String externalId, boolean retry) throws SQLException {
        var sql = retry ? """
                UPDATE inbound_events SET status = 'pending', attempts = 0, last_error = NULL, next_attempt_at = NULL
                WHERE source = ? AND external_event_id = ? AND status = 'quarantined'
                """ : """
                DELETE FROM inbound_events WHERE source = ? AND external_event_id = ? AND status = 'quarantined'
                """;
        try (var statement = connection.prepareStatement(sql)) {
            statement.setString(1, source);
            statement.setString(2, externalId);
            return statement.executeUpdate() == 1;
        }
    }

    private void insertEvents(String source, List<Event> events) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO inbound_events (source, external_event_id, payload, received_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (source, external_event_id) DO NOTHING
                """)) {
            for (var event : events) {
                statement.setString(1, source);
                statement.setString(2, event.externalId());
                statement.setString(3, event.payload());
                statement.setString(4, SqliteDatabase.timestamp(event.receivedAt()));
                statement.addBatch();
            }
            statement.executeBatch();
        }
    }

    private void saveCursor(String source, String nextCursor) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO inbound_event_cursors (source, cursor) VALUES (?, ?)
                ON CONFLICT (source) DO UPDATE SET cursor = excluded.cursor
                """)) {
            statement.setString(1, source);
            statement.setString(2, nextCursor);
            statement.executeUpdate();
        }
    }
}
