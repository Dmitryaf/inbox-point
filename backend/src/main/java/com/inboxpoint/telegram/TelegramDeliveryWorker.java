package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;

final class TelegramDeliveryWorker {
    private static final int ATTEMPT_LIMIT = 5;

    private final TelegramStore store;
    private final TelegramBotApi api;
    private final Clock clock;

    TelegramDeliveryWorker(TelegramStore store, TelegramBotApi api, Clock clock) {
        this.store = store;
        this.api = api;
        this.clock = clock;
    }

    void run() throws SQLException, InterruptedException {
        while (!Thread.currentThread().isInterrupted()) {
            int processed = runOnce();
            Thread.sleep(Duration.ofMillis(processed > 0 ? 100 : 1_000));
        }
    }

    int runOnce() throws SQLException, InterruptedException {
        var submitted = store.pending(clock.instant());
        for (var item : submitted) {
            long sent;
            try {
                sent = api.sendMessage(item.conversation(), null, item.text());
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.outcomeUnknown() || item.attempts() + 1 >= ATTEMPT_LIMIT) {
                    store.failed(item.key());
                } else {
                    long delay = Math.min(5L << item.attempts(), 300);
                    store.schedule(item.key(), clock.instant().plusSeconds(delay));
                }
                continue;
            }
            store.complete(item, sent, clock.instant());
        }
        return submitted.size();
    }
}
