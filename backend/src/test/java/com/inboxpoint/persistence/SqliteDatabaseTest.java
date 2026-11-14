package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.ResultSet;
import java.sql.SQLException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqliteDatabaseTest {
    @TempDir
    Path tempDirectory;

    @Test
    void readsAnExistingRequestFromTheTypeScriptSchema() throws Exception {
        var path = LegacySqlite.createVersion17(tempDirectory);

        try (var connection = SqliteDatabase.openExisting(path);
                var query = connection.prepareStatement("""
                        SELECT channel, external_conversation_id, operator_topic_id, created_at
                        FROM support_requests
                        WHERE id = ?
                        """)) {
            query.setString(1, "request-1");
            try (var request = query.executeQuery()) {
                assertThat(request.next()).isTrue();
                assertThat(request.getString("channel")).isEqualTo("telegram");
                assertThat(request.getString("external_conversation_id")).isEqualTo("1234567890123");
                assertThat(request.getString("operator_topic_id")).isEqualTo("501");
                assertThat(request.getString("created_at")).isEqualTo("2026-11-01T10:00:00.000Z");
                assertThat(request.next()).isFalse();
            }
        }
    }

    @Test
    void enforcesForeignKeysAndRetainsLegacyDurabilitySettings() throws Exception {
        var path = LegacySqlite.createVersion17(tempDirectory);

        try (var connection = SqliteDatabase.openExisting(path);
                var statement = connection.createStatement()) {
            assertThat(scalar(statement.executeQuery("PRAGMA journal_mode"))).isEqualTo("wal");
            assertThat(scalar(statement.executeQuery("PRAGMA synchronous"))).isEqualTo("2");
            assertThat(scalar(statement.executeQuery("PRAGMA busy_timeout"))).isEqualTo("5000");
            assertThatThrownBy(() -> statement.executeUpdate("""
                    INSERT INTO operator_event_bindings (source, external_event_id, request_id)
                    VALUES ('operator:telegram', '999', 'nonexistent-request')
                    """))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("FOREIGN KEY constraint failed");
        }
    }

    @Test
    void refusesAnUnsupportedDatabaseWithoutChangingIt() throws Exception {
        var path = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = LegacySqlite.connect(path);
                var statement = connection.createStatement()) {
            statement.execute("PRAGMA user_version = 18");
        }

        assertThatThrownBy(() -> SqliteDatabase.openExisting(path))
                .isInstanceOf(SQLException.class)
                .hasMessageContaining("Unsupported SQLite schema version 18");

        try (var connection = LegacySqlite.connect(path);
                var statement = connection.createStatement()) {
            assertThat(scalar(statement.executeQuery("PRAGMA user_version"))).isEqualTo("18");
            assertThat(scalar(statement.executeQuery("PRAGMA journal_mode"))).isEqualTo("delete");
            assertThat(scalar(statement.executeQuery("SELECT COUNT(*) FROM support_requests"))).isEqualTo("1");
        }
    }

    @Test
    void openingAMissingDatabaseDoesNotCreateIt() {
        var path = tempDirectory.resolve("missing.sqlite");

        assertThatThrownBy(() -> SqliteDatabase.openExisting(path)).isInstanceOf(SQLException.class);
        assertThat(path).doesNotExist();
    }

    private static String scalar(ResultSet rows) throws SQLException {
        try (rows) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }
}
