package com.inboxpoint.telegram;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

import com.inboxpoint.persistence.ServiceSnapshot;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServiceSnapshotTest {
    @TempDir
    Path directory;

    @Test
    void restoresTheRetainedCopyWithoutCredentialsAndRejectsChangedBytes() throws Exception {
        var database = directory.resolve("service.sqlite");
        var now = Instant.parse("2026-10-01T12:00:00Z");
        var earlier = now.minus(Duration.ofDays(10));
        Files.writeString(directory.resolve("telegram-settings.json"), "synthetic-connection-setting");
        Files.writeString(directory.resolve("content-settings.json"), "{}");
        try (var original = new TelegramStore(database)) {
            var finished = new TelegramStore.Request("finished", 12, 41, true, "telegram");
            original.open(finished, "Synthetic name", earlier);
            original.recordMessage(finished.id(), "client_to_operator", "1", "Synthetic name", "Expired question", earlier);
            original.changeStatus(finished.id(), false, earlier);
            var outstanding = new TelegramStore.Request("pending", 13, 42, true, "telegram");
            original.open(outstanding, "Another name", earlier);
            original.queue(outstanding, "queued", 4, "Waiting for delivery", earlier);
            original.changeStatus(outstanding.id(), false, earlier);

            try (var sql = java.sql.DriverManager.getConnection("jdbc:sqlite:" + database); var statement = sql.createStatement()) {
                statement.executeUpdate("INSERT INTO remembered_admin_sessions VALUES ('synthetic-hash', 1, 9999999999999)");
            }
            var snapshot = new ServiceSnapshot(database, 7).create(now);
            var bytes = Files.readString(snapshot.resolve("database.sqlite"), java.nio.charset.StandardCharsets.ISO_8859_1);
            assertThat(bytes).doesNotContain("Expired question").contains("Waiting for delivery");
            assertThat(ServiceSnapshot.verify(snapshot).files()).extracting(ServiceSnapshot.FileEntry::name)
                    .containsExactly("database.sqlite", "content-settings.json");
            var target = directory.resolve("restored");
            var copy = ServiceSnapshot.restore(snapshot, target);
            assertThat(Files.exists(target.resolve("telegram-settings.json"))).isFalse();
            try (var sql = java.sql.DriverManager.getConnection("jdbc:sqlite:" + copy); var statement = sql.createStatement();
                    var sessions = statement.executeQuery("SELECT COUNT(*) FROM remembered_admin_sessions")) {
                assertThat(sessions.getInt(1)).isZero();
            }
            try (var restored = new TelegramStore(copy)) {
                assertThat(restored.operatorMessages(finished.id())).isEmpty();
                assertThat(restored.operatorMessages(outstanding.id())).hasSize(1);
            }
            assertThat(original.operatorMessages(finished.id())).hasSize(1);
            assertThat(original.purge(now.minus(Duration.ofDays(7))).skippedRequests()).isEqualTo(1);
            assertThat(original.operatorMessages(finished.id())).isEmpty();
            Files.writeString(snapshot.resolve("content-settings.json"), "[]");
            assertThatThrownBy(() -> ServiceSnapshot.restore(snapshot, directory.resolve("bad")))
                    .isInstanceOf(java.io.IOException.class).hasMessageContaining("checksum");
            assertThat(Files.exists(directory.resolve("bad"))).isFalse();
        }
    }
}
