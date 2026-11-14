package com.inboxpoint.telegram;

import java.nio.file.Path;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class AvailableDeliveryBatchTest {
    @TempDir
    Path directory;

    @Test
    void staleTelegramBacklogDoesNotFillTheVkBatch() throws Exception {
        var now = Instant.parse("2026-11-18T08:00:00Z");
        try (var store = new TelegramStore(directory.resolve("available.sqlite"))) {
            var tg = new TelegramStore.Request("tg", 123, "42", true, "telegram");
            var vk = new TelegramStore.Request("vk", 456, "43", true, "vk");
            store.open(tg, now.minusSeconds(100));
            store.open(vk, now.minusSeconds(90));
            for (int index = 0; index < 30; index++) {
                store.queue(tg, "tg:" + index, index + 1L, "Unavailable channel", now.minusSeconds(10));
            }
            store.queue(vk, "vk:1", 1L, "Available channel", now);
            assertThat(store.pending(now, false, false)).isEmpty();
            assertThat(store.pending(now, false, true)).singleElement().satisfies(item -> assertThat(item.channel()).isEqualTo("vk"));
        }
    }
}
