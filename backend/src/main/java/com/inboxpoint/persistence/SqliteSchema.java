package com.inboxpoint.persistence;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;

final class SqliteSchema {
    private static final int CURRENT_VERSION = 17;
    private static final int MINIMUM_PREVIOUS_VERSION = 3;

    private SqliteSchema() {
    }

    static void requireCurrentVersion(Connection connection) throws SQLException {
        var version = version(connection);
        if (version != CURRENT_VERSION) {
            throw unsupportedVersion(version);
        }
    }

    static void initialize(Connection connection) throws SQLException {
        var version = version(connection);
        if (version == 0 && !hasApplicationTables(connection)) {
            SqliteDatabase.writeTransaction(connection, () -> {
                executeScript(connection, "schema-v17.sql");
                execute(connection, "PRAGMA user_version = " + CURRENT_VERSION);
            });
            return;
        }
        if (version < MINIMUM_PREVIOUS_VERSION || version > CURRENT_VERSION) {
            throw unsupportedVersion(version);
        }
        for (var target = version + 1; target <= CURRENT_VERSION; target++) {
            migrate(connection, target);
        }
    }

    private static void migrate(Connection connection, int target) throws SQLException {
        if (target == 6) {
            migrateTopicReuse(connection);
            return;
        }
        SqliteDatabase.writeTransaction(connection, () -> {
            switch (target) {
                case 9 -> addHeldReplyColumns(connection);
                case 13 -> addConversationContext(connection, "application_label");
                case 14 -> addConversationContext(connection, "question_context");
                case 15 -> addColumn(connection, "client_conversation_states", "class_enrollment",
                        "INTEGER NOT NULL DEFAULT 0 CHECK (class_enrollment IN (0, 1))");
                case 16 -> addEnrollmentConfirmationColumns(connection);
                case 17 -> {
                    executeScript(connection, "schema-v17.sql");
                    executeScript(connection, "to-v17-bindings.sql");
                }
                default -> executeScript(connection, "to-v" + target + ".sql");
            }
            execute(connection, "PRAGMA user_version = " + target);
        });
    }

    private static void migrateTopicReuse(Connection connection) throws SQLException {
        execute(connection, "PRAGMA foreign_keys = OFF");
        try {
            SqliteDatabase.writeTransaction(connection, () -> {
                executeScript(connection, "to-v6.sql");
                try (var statement = connection.createStatement();
                        var rows = statement.executeQuery("PRAGMA foreign_key_check")) {
                    if (rows.next()) {
                        throw new SQLException("SQLite topic reuse migration violated foreign keys");
                    }
                }
                execute(connection, "PRAGMA user_version = 6");
            });
        } finally {
            execute(connection, "PRAGMA foreign_keys = ON");
        }
    }

    private static void addHeldReplyColumns(Connection connection) throws SQLException {
        addColumn(connection, "conversation_messages", "processing_state",
                "TEXT NOT NULL DEFAULT 'accepted' CHECK (processing_state IN ('accepted', 'held'))");
        addColumn(connection, "conversation_messages", "event_source", "TEXT");
        addColumn(connection, "conversation_messages", "external_event_id", "TEXT");
        addColumn(connection, "conversation_messages", "prerequisite_action_id", "TEXT");
        addColumn(connection, "conversation_messages", "held_sequence", "INTEGER CHECK (held_sequence >= 0)");
        executeScript(connection, "to-v9-indexes.sql");
    }

    private static void addConversationContext(Connection connection, String column) throws SQLException {
        executeScript(connection, "conversation-state-table.sql");
        addColumn(connection, "client_conversation_states", column, "TEXT");
        addColumn(connection, "conversation_messages", column, "TEXT");
    }

    private static void addEnrollmentConfirmationColumns(Connection connection) throws SQLException {
        addColumn(connection, "client_conversation_states", "enrollment_confirmation_text", "TEXT");
        addColumn(connection, "conversation_messages", "enrollment_confirmation_text", "TEXT");
        addColumn(connection, "conversation_messages", "enrollment_notified_at", "TEXT");
        addColumn(connection, "conversation_messages", "enrollment_notification_next_attempt_at", "TEXT");
    }

    private static void addColumn(Connection connection, String table, String column, String definition)
            throws SQLException {
        try (var query = connection.prepareStatement("SELECT 1 FROM pragma_table_info(?) WHERE name = ?")) {
            query.setString(1, table);
            query.setString(2, column);
            try (var rows = query.executeQuery()) {
                if (rows.next()) {
                    return;
                }
            }
        }
        execute(connection, "ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
    }

    private static int version(Connection connection) throws SQLException {
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("PRAGMA user_version")) {
            return rows.next() ? rows.getInt(1) : 0;
        }
    }

    private static boolean hasApplicationTables(Connection connection) throws SQLException {
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("""
                        SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1
                        """)) {
            return rows.next();
        }
    }

    private static void executeScript(Connection connection, String script) throws SQLException {
        try (var input = SqliteSchema.class.getResourceAsStream("/db/sqlite/" + script)) {
            if (input == null) {
                throw new SQLException("Missing SQLite script " + script);
            }
            execute(connection, new String(input.readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException failure) {
            throw new SQLException("Could not read SQLite script " + script, failure);
        }
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }

    private static SQLException unsupportedVersion(int version) {
        return new SQLException("Unsupported SQLite schema version " + version + "; expected " + CURRENT_VERSION);
    }
}
