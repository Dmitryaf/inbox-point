package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import com.inboxpoint.persistence.SqliteTextHandoff.ChannelIdentity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class SqliteChannelIdentityTest {
    private static final Instant NOW = Instant.parse("2026-11-01T10:02:00Z");

    @TempDir
    Path directory;

    @Test
    void allowsChangingAnUnusedIdentityButRetainsIdentityOnceItsCursorExists() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.claimChannelIdentity("vk", "48")).isEqualTo(ChannelIdentity.ACCEPTED);
            assertThat(store.claimChannelIdentity("vk", "49")).isEqualTo(ChannelIdentity.ACCEPTED);
            store.saveUpdates("vk:long-poll", List.of(), "104", NOW);
        }
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            assertThat(store.claimChannelIdentity("vk", "48")).isEqualTo(ChannelIdentity.CONFLICT);
            assertThat(store.claimChannelIdentity("vk", "49")).isEqualTo(ChannelIdentity.ACCEPTED);
            assertThat(store.claimChannelIdentity("telegram", "1:-1001")).isEqualTo(ChannelIdentity.ACCEPTED);
        }
    }

    @Test
    void refusesToClaimLegacyChannelHistoryAutomatically() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        try (var store = SqliteTextHandoff.open(database, NOW)) {
            store.saveUpdates("vk:long-poll", List.of(), "104", NOW);
            assertThat(store.claimChannelIdentity("vk", "48")).isEqualTo(ChannelIdentity.LEGACY_UNBOUND);
            assertThat(store.claimChannelIdentity("vk", "49")).isEqualTo(ChannelIdentity.LEGACY_UNBOUND);
        }
    }
}
