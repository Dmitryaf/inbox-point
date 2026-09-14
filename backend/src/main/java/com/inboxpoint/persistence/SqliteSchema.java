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
            int previous;
            try (var version = statement.executeQuery("PRAGMA user_version")) {
                previous = version.next() ? version.getInt(1) : 0;
                if (previous > 7) {
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
            if (previous > 0 && previous < 6) {
                migrateTopicReuse(statement);
            }
            statement.execute("CREATE INDEX IF NOT EXISTS support_requests_by_operator_topic ON support_requests(operator_topic_id, status, created_at)");
            statement.execute(topicTrigger("insert", "INSERT", ""));
            statement.execute(topicTrigger("update", "UPDATE OF operator_topic_id, channel, external_conversation_id", " AND id <> NEW.id"));
            statement.execute("PRAGMA user_version = 7");
        }
    }

    private static void migrateTopicReuse(java.sql.Statement statement) throws SQLException {
        statement.execute("PRAGMA foreign_keys = OFF");
        try {
            statement.execute("BEGIN IMMEDIATE");
            try {
                boolean migrationRequired;
                try (var version = statement.executeQuery("PRAGMA user_version")) {
                    migrationRequired = version.next() && version.getInt(1) < 6;
                }
                if (migrationRequired) {
                    statement.execute("""
                            CREATE TABLE support_requests_v6 (
                                id TEXT PRIMARY KEY,
                                channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
                                external_conversation_id TEXT NOT NULL,
                                operator_topic_id TEXT NOT NULL,
                                status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
                                created_at TEXT NOT NULL, closed_at TEXT, client_display_name TEXT
                            ) STRICT
                            """);
                    statement.execute("""
                            INSERT INTO support_requests_v6
                            SELECT id, channel, external_conversation_id, operator_topic_id, status, created_at,
                                closed_at, client_display_name FROM support_requests
                            """);
                    statement.execute("DROP TABLE support_requests");
                    statement.execute("ALTER TABLE support_requests_v6 RENAME TO support_requests");
                    statement.execute("""
                            CREATE UNIQUE INDEX one_active_request_per_conversation
                            ON support_requests(channel, external_conversation_id) WHERE status = 'active'
                            """);
                    try (var violations = statement.executeQuery("PRAGMA foreign_key_check")) {
                        if (violations.next()) {
                            throw new SQLException("SQLite topic reuse migration violated foreign keys");
                        }
                    }
                    statement.execute("PRAGMA user_version = 6");
                }
                statement.execute("COMMIT");
            } catch (SQLException | RuntimeException failed) {
                statement.execute("ROLLBACK");
                throw failed;
            }
        } finally {
            statement.execute("PRAGMA foreign_keys = ON");
        }
    }

    private static String topicTrigger(String label, String operation, String excludeCurrent) {
        return """
                CREATE TRIGGER IF NOT EXISTS operator_topic_conversation_%s
                BEFORE %s ON support_requests WHEN EXISTS (
                    SELECT 1 FROM support_requests WHERE operator_topic_id = NEW.operator_topic_id%s
                    AND (channel <> NEW.channel OR external_conversation_id <> NEW.external_conversation_id)
                ) BEGIN SELECT RAISE(ABORT, 'operator topic belongs to another conversation'); END
                """.formatted(label, operation, excludeCurrent);
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
