package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqliteSchemaTest {
    @TempDir
    Path directory;

    @Test
    void initializesAnEmptyDatabaseWithTheSameSchemaAsThePreviousRuntime() throws Exception {
        var existing = LegacySqlite.createVersion17(directory);
        try (var legacy = LegacySqlite.connect(existing);
                var fresh = SqliteDatabase.openOrMigrate(directory.resolve("fresh.sqlite"))) {
            assertThat(scalar(fresh, "PRAGMA user_version")).isEqualTo("17");
            var query = """
                    SELECT group_concat(sql, char(10)) FROM (
                        SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY name
                    )
                    """;
            assertThat(scalar(fresh, query).replaceAll("\\s+", " "))
                    .isEqualTo(scalar(legacy, query).replaceAll("\\s+", " "));
        }
    }

    @Test
    void migratesFromVersionThreeAndKeepsTheLegacyRequest() throws Exception {
        var path = LegacySqlite.createVersion17(directory);
        try (var connection = LegacySqlite.connect(path)) {
            execute(connection, """
                    DROP TABLE operator_actions;
                    DROP TABLE inbound_events;
                    CREATE TABLE inbound_events (
                        source TEXT NOT NULL, external_event_id TEXT NOT NULL,
                        payload TEXT NOT NULL, received_at TEXT NOT NULL,
                        PRIMARY KEY (source, external_event_id)
                    ) STRICT;
                    PRAGMA user_version = 3;
                    """);
        }
        try (var migrated = SqliteDatabase.openOrMigrate(path)) {
            assertThat(scalar(migrated, "PRAGMA user_version")).isEqualTo("17");
            assertThat(scalar(migrated, "SELECT operator_topic_id FROM support_requests WHERE id = 'request-1'"))
                    .isEqualTo("501");
            assertThat(scalar(migrated, "SELECT COUNT(*) FROM operator_actions")).isEqualTo("0");
            assertThat(scalar(migrated, "SELECT COUNT(*) FROM pragma_foreign_key_check")).isEqualTo("0");
            assertThat(scalar(migrated, "PRAGMA foreign_keys")).isEqualTo("1");
        }
    }

    @Test
    void removesTheOldTopicUniquenessConstraintWithoutBreakingMessageReferences() throws Exception {
        var path = directory.resolve("v5.sqlite");
        try (var connection = LegacySqlite.connect(path)) {
            execute(connection, """
                    CREATE TABLE support_requests (
                        id TEXT PRIMARY KEY,
                        channel TEXT NOT NULL CHECK (channel IN ('telegram', 'vk')),
                        external_conversation_id TEXT NOT NULL,
                        client_display_name TEXT,
                        operator_topic_id TEXT NOT NULL UNIQUE,
                        status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
                        created_at TEXT NOT NULL,
                        closed_at TEXT
                    ) STRICT;
                    CREATE TABLE conversation_messages (
                        id TEXT PRIMARY KEY,
                        request_id TEXT NOT NULL REFERENCES support_requests(id),
                        direction TEXT NOT NULL, external_message_id TEXT NOT NULL, sender_name TEXT,
                        text TEXT NOT NULL, created_at TEXT NOT NULL,
                        UNIQUE (request_id, direction, external_message_id)
                    ) STRICT;
                    INSERT INTO support_requests (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                    VALUES ('older', 'telegram', '101', '501', 'closed', '2026-09-01T10:00:00.000Z');
                    INSERT INTO conversation_messages (id, request_id, direction, external_message_id, text, created_at)
                    VALUES ('history', 'older', 'client_to_operator', '17', 'Synthetic', '2026-09-01T10:00:00.000Z');
                    PRAGMA user_version = 5;
                    """);
        }
        try (var migrated = SqliteDatabase.openOrMigrate(path)) {
            execute(migrated, """
                    INSERT INTO support_requests (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                    VALUES ('newer', 'telegram', '101', '501', 'active', '2026-09-02T10:00:00.000Z');
                    """);
            assertThat(scalar(migrated, "SELECT request_id FROM conversation_messages WHERE id = 'history'"))
                    .isEqualTo("older");
            assertThat(scalar(migrated, "SELECT COUNT(*) FROM pragma_foreign_key_check")).isEqualTo("0");
        }
    }

    @Test
    void backfillsAnOperatorEventBindingFromAnExistingDeliveryWhenMigratingVersionSixteen() throws Exception {
        var path = LegacySqlite.createVersion17(directory);
        try (var connection = LegacySqlite.connect(path)) {
            execute(connection, """
                    DROP TABLE operator_event_bindings;
                    DROP TABLE channel_connection_identities;
                    INSERT INTO deliveries (id, request_id, idempotency_key, channel, external_conversation_id, text,
                                            status, created_at)
                    VALUES ('answer', 'request-1', 'operator:104', 'telegram', '1234567890123', 'Synthetic',
                            'pending', '2026-11-01T10:01:00.000Z');
                    PRAGMA user_version = 16;
                    """);
        }
        try (var migrated = SqliteDatabase.openOrMigrate(path)) {
            assertThat(scalar(migrated, """
                    SELECT request_id FROM operator_event_bindings
                    WHERE source = 'operator:telegram' AND external_event_id = '104'
                    """)).isEqualTo("request-1");
            assertThat(scalar(migrated, "SELECT status FROM deliveries WHERE id = 'answer'")).isEqualTo("pending");
        }
    }

    @Test
    void preservesThePreviousVersionAndRowsWhenOneMigrationFails() throws Exception {
        var path = LegacySqlite.createVersion17(directory);
        try (var connection = LegacySqlite.connect(path)) {
            execute(connection, """
                    DROP TABLE usage_events;
                    CREATE TABLE usage_events (
                        id TEXT PRIMARY KEY, event_type TEXT NOT NULL, channel TEXT NOT NULL,
                        request_id TEXT, occurred_at TEXT NOT NULL
                    ) STRICT;
                    INSERT INTO usage_events (id, event_type, channel, occurred_at)
                    VALUES ('bad', 'unsupported', 'telegram', '2026-11-01T10:00:00.000Z');
                    PRAGMA user_version = 11;
                    """);
        }

        assertThatThrownBy(() -> SqliteDatabase.openOrMigrate(path)).isInstanceOf(SQLException.class);

        try (var unchanged = LegacySqlite.connect(path)) {
            assertThat(scalar(unchanged, "PRAGMA user_version")).isEqualTo("11");
            assertThat(scalar(unchanged, "SELECT event_type FROM usage_events WHERE id = 'bad'")).isEqualTo("unsupported");
            assertThat(scalar(unchanged, """
                    SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = 'usage_events_v11'
                    """)).isEqualTo("0");
        }
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate(sql);
        }
    }

    private static String scalar(Connection connection, String sql) throws SQLException {
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery(sql)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
