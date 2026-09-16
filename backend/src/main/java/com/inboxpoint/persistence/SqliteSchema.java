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
                if (previous > 8) {
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
            ensureColumn(connection, "support_requests", "web_owned_at", "TEXT");
            if (previous > 0 && previous < 8) {
                migrateLifecycleActions(statement);
            }
            statement.execute("""
                    CREATE TRIGGER IF NOT EXISTS clear_client_conversation_state_on_request
                    AFTER INSERT ON support_requests BEGIN
                        DELETE FROM client_conversation_states WHERE channel = NEW.channel
                            AND external_conversation_id = NEW.external_conversation_id;
                    END
                    """);
            statement.execute("""
                    CREATE TRIGGER IF NOT EXISTS clear_client_question_on_reopen
                    AFTER UPDATE OF status ON support_requests WHEN OLD.status = 'closed' AND NEW.status = 'active' BEGIN
                        DELETE FROM client_conversation_states WHERE channel = NEW.channel
                            AND external_conversation_id = NEW.external_conversation_id;
                    END
                    """);
            statement.execute("PRAGMA user_version = 8");
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

    private static void migrateLifecycleActions(java.sql.Statement statement) throws SQLException {
        statement.execute("BEGIN IMMEDIATE");
        try {
            boolean required;
            try (var version = statement.executeQuery("PRAGMA user_version")) {
                required = version.next() && version.getInt(1) < 8;
            }
            if (required) {
                statement.execute("ALTER TABLE operator_actions RENAME TO operator_actions_v7");
                statement.execute("""
                              CREATE TABLE IF NOT EXISTS operator_actions (
                                id TEXT PRIMARY KEY,
                                request_id TEXT NOT NULL REFERENCES support_requests(id),
                                kind TEXT NOT NULL CHECK (kind IN ('open_request', 'relay_message', 'close_request', 'reopen_request')),
                                client_message_id TEXT NOT NULL,
                                operator_topic_id TEXT NOT NULL,
                                sequence INTEGER NOT NULL,
                                initial INTEGER NOT NULL CHECK (initial IN (0, 1)),
                                status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'outcome_unknown', 'abandoned')),
                                external_result_id TEXT,
                                last_error TEXT,
                                attempt_started_at TEXT,
                                completed_at TEXT,
                                manual_resolution TEXT CHECK (manual_resolution IN ('confirmed_received', 'use_web', 'completed', 'not_completed')),
                                resolved_at TEXT,
                                created_at TEXT NOT NULL
                              ) STRICT
                        """);
                statement.execute("INSERT INTO operator_actions SELECT * FROM operator_actions_v7");
                statement.execute("DROP TABLE operator_actions_v7");
                statement.execute("CREATE INDEX operator_actions_by_request ON operator_actions(request_id, client_message_id, sequence)");
                statement.execute("CREATE INDEX operator_actions_by_status ON operator_actions(status, created_at)");
                statement.execute("PRAGMA user_version = 8");
            }
            statement.execute("COMMIT");
        } catch (SQLException | RuntimeException failure) {
            statement.execute("ROLLBACK");
            throw failure;
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
