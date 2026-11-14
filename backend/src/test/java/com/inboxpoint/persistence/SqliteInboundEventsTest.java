package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SqliteInboundEventsTest {
    private static final String TELEGRAM = "telegram:get-updates";
    private static final Instant NOW = Instant.parse("2026-11-01T10:02:00Z");
    private static final String UPDATE = "{\"update_id\":104}";

    @TempDir
    Path tempDirectory;

    @Test
    void persistsTheBatchAndOffsetTogetherAndKeepsTheFirstPayloadOnReplay() throws Exception {
        var path = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = SqliteDatabase.openExisting(path)) {
            var inbound = new SqliteInboundEvents(connection);
            assertThat(inbound.cursor(TELEGRAM)).isEmpty();
            inbound.acceptBatch(TELEGRAM, List.of(new SqliteInboundEvents.Event("104", UPDATE, NOW)), "105");
        }

        try (var connection = SqliteDatabase.openExisting(path)) {
            var inbound = new SqliteInboundEvents(connection);
            assertThat(inbound.cursor(TELEGRAM)).contains("105");
            inbound.acceptBatch(TELEGRAM, List.of(
                    new SqliteInboundEvents.Event("104", "{\"update_id\":104,\"other\":true}", NOW),
                    new SqliteInboundEvents.Event("105", "{\"update_id\":105}", NOW)), "106");

            assertThat(inbound.cursor(TELEGRAM)).contains("106");
            assertThat(payload(connection, "104")).isEqualTo(UPDATE);
            assertThat(payload(connection, "105")).isEqualTo("{\"update_id\":105}");
        }
    }

    @Test
    void rollsBackNewEventsIfTheCursorCannotBeWritten() throws Exception {
        var path = LegacySqlite.createVersion17(tempDirectory);
        try (var connection = SqliteDatabase.openExisting(path)) {
            var inbound = new SqliteInboundEvents(connection);
            inbound.acceptBatch(TELEGRAM, List.of(new SqliteInboundEvents.Event("104", UPDATE, NOW)), "105");
            try (var statement = connection.createStatement()) {
                statement.execute("""
                        CREATE TRIGGER fixture_reject_cursor
                        BEFORE UPDATE ON inbound_event_cursors
                        BEGIN
                            SELECT RAISE(ABORT, 'cursor storage failure');
                        END
                        """);
            }

            assertThatThrownBy(() -> inbound.acceptBatch(TELEGRAM,
                    List.of(new SqliteInboundEvents.Event("105", "{\"update_id\":105}", NOW)), "106"))
                    .isInstanceOf(SQLException.class)
                    .hasMessageContaining("cursor storage failure");

            assertThat(inbound.cursor(TELEGRAM)).contains("105");
            assertThat(payload(connection, "105")).isNull();
        }
    }

    private static String payload(Connection connection, String eventId) throws SQLException {
        try (var statement = connection.prepareStatement("""
                SELECT payload FROM inbound_events WHERE source = ? AND external_event_id = ?
                """)) {
            statement.setString(1, TELEGRAM);
            statement.setString(2, eventId);
            try (var rows = statement.executeQuery()) {
                return rows.next() ? rows.getString("payload") : null;
            }
        }
    }
}
