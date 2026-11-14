package com.inboxpoint.operations;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import com.inboxpoint.persistence.SqliteTextHandoff;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChannelIdentityCommandTest {
    @TempDir
    Path directory;

    @Test
    void confirmsOnlyTheExplicitlyVerifiedIdentityAndLeavesPendingEventsIntact() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        var now = Instant.now();
        try (var store = SqliteTextHandoff.open(database, now)) {
            store.saveUpdates("vk:long-poll", List.of(new SqliteTextHandoff.IncomingUpdate("fixture", "{}")), "100", now);
        }
        var health = new ArrayList<String>();
        ChannelIdentityCommand.run(database, new String[]{"vk"}, channel -> "48", health::add);
        assertThat(health).anySatisfy(line -> assertThat(line).contains("group_id=48"));
        try (var store = SqliteTextHandoff.openExisting(database)) {
            assertThat(store.claimChannelIdentity("vk", "48")).isEqualTo(SqliteTextHandoff.ChannelIdentity.LEGACY_UNBOUND);
        }
        assertThatThrownBy(() -> ChannelIdentityCommand.run(database, confirmVk(49), channel -> "48", health::add))
                .hasMessageContaining("не совпали");
        ChannelIdentityCommand.run(database, confirmVk(48), channel -> "48", health::add);
        ChannelIdentityCommand.run(database, confirmVk(48), channel -> "48", health::add);
        assertThatThrownBy(() -> ChannelIdentityCommand.run(database, confirmVk(49), channel -> "49", health::add))
                .hasMessageContaining("другим подключением");
        try (var store = SqliteTextHandoff.openExisting(database)) {
            assertThat(store.claimChannelIdentity("vk", "48")).isEqualTo(SqliteTextHandoff.ChannelIdentity.ACCEPTED);
            assertThat(store.pendingUpdate("vk:long-poll")).get()
                    .extracting(SqliteTextHandoff.PendingUpdate::id).isEqualTo("fixture");
            assertThat(store.cursor("vk:long-poll")).contains("100");
        }
    }

    @Test
    void refusesToCreateAMissingDatabase() {
        var absent = directory.resolve("missing.sqlite");
        assertThatThrownBy(() -> ChannelIdentityCommand.run(absent, confirmVk(48), channel -> "48", ignored -> { }))
                .isInstanceOf(java.sql.SQLException.class);
        assertThat(absent).doesNotExist();
    }

    private static String[] confirmVk(long id) {
        return new String[]{"vk", "--confirm-previous-connection", "--group-id=" + id};
    }
}
