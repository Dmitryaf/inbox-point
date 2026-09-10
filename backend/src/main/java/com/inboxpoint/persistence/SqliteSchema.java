package com.inboxpoint.persistence;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;

public final class SqliteSchema {
    private SqliteSchema() { }

    public static void initialize(Connection connection) throws IOException, SQLException {
        try (var schema = SqliteSchema.class.getResourceAsStream("/db/sqlite/telegram-handoff.sql");
                var statement = connection.createStatement()) {
            if (schema == null) {
                throw new IOException("Telegram storage schema is missing");
            }
            try (var version = statement.executeQuery("PRAGMA user_version")) {
                if (version.next() && version.getInt(1) > 5) {
                    throw new SQLException("Unsupported SQLite schema version");
                }
            }
            var sql = new String(schema.readAllBytes(), StandardCharsets.UTF_8);
            for (var command : sql.split(";")) {
                if (!command.isBlank()) {
                    statement.execute(command);
                }

            }
            ensureColumn(connection, "deliveries", "operator_message_id", "TEXT");
            ensureColumn(connection, "deliveries", "next_attempt_at", "TEXT");
            ensureColumn(connection, "deliveries", "outcome_unknown", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "deliveries", "manual_resolution",
                    "TEXT CHECK (manual_resolution IN ('confirmed_received', 'confirmed_not_received'))");
            ensureColumn(connection, "deliveries", "resolved_at", "TEXT");
            ensureColumn(connection, "deliveries", "operator_notified_at", "TEXT");
            ensureColumn(connection, "deliveries", "notification_next_attempt_at", "TEXT");
            ensureColumn(connection, "deliveries", "attempt_started_at", "TEXT");
            statement.execute("UPDATE deliveries SET outcome_unknown = 1 WHERE last_error = 'Uncertain Telegram result' "
                    + "AND status = 'failed' AND outcome_unknown = 0");
            ensureColumn(connection, "support_requests", "client_display_name", "TEXT");
            ensureColumn(connection, "processed_events", "status", "TEXT NOT NULL DEFAULT 'completed'");
            ensureColumn(connection, "processed_events", "completed_at", "TEXT");
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS inbound_events (
                        source TEXT NOT NULL, external_event_id TEXT NOT NULL, payload TEXT NOT NULL,
                        received_at TEXT NOT NULL, PRIMARY KEY (source, external_event_id)
                    ) STRICT
                    """);
            ensureColumn(connection, "inbound_events", "attempts", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn(connection, "inbound_events", "status", "TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'quarantined'))");
            ensureColumn(connection, "inbound_events", "last_error", "TEXT");
            ensureColumn(connection, "inbound_events", "next_attempt_at", "TEXT");
            statement.execute("CREATE INDEX IF NOT EXISTS inbound_events_by_status ON inbound_events(source, status, received_at)");
            statement.execute("PRAGMA user_version = 5");
        }
    }

    private static void ensureColumn(Connection connection, String table, String name, String definition) throws SQLException {
        try (var statement = connection.prepareStatement("SELECT 1 FROM pragma_table_info(?) WHERE name = ?")) {
            statement.setString(1, table);
            statement.setString(2, name);
            try (var columns = statement.executeQuery()) {
                if (columns.next()) {
                    return;
                }
            }
        }
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + table + " ADD COLUMN " + name + " " + definition);
        }
    }

}
