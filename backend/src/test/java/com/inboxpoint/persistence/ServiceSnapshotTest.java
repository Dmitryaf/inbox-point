package com.inboxpoint.persistence;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServiceSnapshotTest {
    @TempDir
    Path directory;

    @Test
    void copiesCommittedWalStateAppliesRetentionToTheCopyAndInvalidatesSessions() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        var now = Instant.parse("2026-11-24T10:00:00Z");
        Files.writeString(directory.resolve("content-settings.json"), "{\"content\":{},\"history\":[]}");
        Files.writeString(directory.resolve("service-control.json"), """
                {"channels":{"telegram":{"mode":"active"},"vk":{"mode":"active"}},"delivery":{"mode":"active"},
                 "expectedChannels":{"telegram":true,"vk":false}}
                """);
        Files.writeString(directory.resolve("telegram-settings.json"), "synthetic-config-that-must-stay-local");
        var service = new ServiceSnapshot(database, directory.resolve("exports"), "test-instance", 7);
        try (var live = SqliteDatabase.openExisting(database); var sql = live.createStatement()) {
            sql.executeUpdate("""
                    INSERT INTO support_requests (id, channel, external_conversation_id, client_display_name, operator_topic_id,
                        status, created_at, closed_at)
                    VALUES ('expired', 'vk', '44', 'Expired fixture', '41', 'closed',
                        '2026-11-01T10:00:00.000Z', '2026-11-02T10:00:00.000Z'),
                       ('recent', 'vk', '45', 'Recent fixture', '42', 'closed',
                        '2026-11-20T10:00:00.000Z', '2026-11-21T10:00:00.000Z')
                    """);
            sql.executeUpdate("INSERT INTO remembered_admin_sessions VALUES ('hash-only-fixture', 0, 9999999999999)");
            var snapshot = service.create(now);
            var manifest = ServiceSnapshot.verify(snapshot);
            assertThat(manifest.expiresAt()).isEqualTo("2026-11-28T10:00:00.000Z");
            assertThat(manifest.files()).extracting(ServiceSnapshot.FileEntry::name)
                    .containsExactly("database.sqlite", "content-settings.json", "service-control.json");
            assertThat(manifest.secretsIncluded()).isFalse();
            assertThat(scalar(database, "SELECT client_display_name FROM support_requests WHERE id = 'expired'"))
                    .isEqualTo("Expired fixture");
            assertThat(scalar(snapshot.resolve("database.sqlite"), "SELECT client_display_name FROM support_requests WHERE id = 'expired'"))
                    .isNull();
            var restored = ServiceSnapshot.restore(snapshot, directory.resolve("restored"));
            assertThat(scalar(restored, "SELECT client_display_name FROM support_requests WHERE id = 'recent'"))
                    .isEqualTo("Recent fixture");
            assertThat(scalar(restored, "SELECT COUNT(*) FROM remembered_admin_sessions")).isEqualTo("0");
            assertThat(Files.readString(restored.resolveSibling("service-control.json"))).contains("\"telegram\":true");
            assertThatThrownBy(() -> ServiceSnapshot.restore(snapshot, directory.resolve("restored")))
                    .isInstanceOf(java.nio.file.FileAlreadyExistsException.class);
            var updated = service.create(now.plus(5, ChronoUnit.DAYS));
            assertThat(snapshot).doesNotExist();
            Files.writeString(updated.resolve("content-settings.json"), "altered");
            assertThatThrownBy(() -> ServiceSnapshot.restore(updated, directory.resolve("corrupted")))
                    .hasMessageContaining("checksum");
            assertThat(directory.resolve("corrupted")).doesNotExist();
        }
    }

    private static String scalar(Path database, String query) throws Exception {
        try (var connection = SqliteDatabase.openArchive(database, true);
                var statement = connection.createStatement(); var rows = statement.executeQuery(query)) {
            return rows.next() ? rows.getString(1) : null;
        }
    }
}
