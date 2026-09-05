package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.util.function.Supplier;

import com.inboxpoint.vk.VkChannel;

final class TelegramDeliveryWorker {
    private final TelegramStore store;
    private final TelegramBotApi api;
    private final Clock clock;
    private final DeliveryFailurePolicy failures;
    private final Supplier<VkChannel> vk;

    TelegramDeliveryWorker(TelegramStore store, TelegramBotApi api, Clock clock) {
        this(store, api, clock, () -> null);
    }

    TelegramDeliveryWorker(TelegramStore store, TelegramBotApi api, Clock clock, Supplier<VkChannel> vk) {
        this.vk = vk;
        this.store = store;
        this.api = api;
        this.clock = clock;
        failures = new DeliveryFailurePolicy(store, clock);
    }

    void run() throws SQLException, InterruptedException {
        while (!Thread.currentThread().isInterrupted()) {
            int processed = runOnce();
            Thread.sleep(Duration.ofMillis(processed > 0 ? 100 : 1_000));
        }
    }

    int runOnce() throws SQLException, InterruptedException {
        var vkChannel = vk.get();
        var submitted = store.pending(clock.instant(), vkChannel != null);
        for (var item : submitted) {
            long sent;
            try {
                sent = "vk".equals(item.channel())
                        ? vkChannel.send(item.conversation(), item.text(), item.key())
                        : api.sendMessage(item.conversation(), null, item.text());
            } catch (IOException failure) {
                failures.record(item, failure);
                continue;
            }
            store.complete(item, sent, clock.instant());
        }
        return submitted.size();
    }
}
