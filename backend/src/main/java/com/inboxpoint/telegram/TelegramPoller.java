package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;

import com.inboxpoint.operations.ChannelActivity;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.json.JsonMapper;

final class TelegramPoller {
    private final TelegramBotApi api;
    private final TelegramTextHandoff handoff;
    private final int timeout;
    private final ChannelActivity activity;
    private final Recovery recovery;
    private final TelegramStore store;

    TelegramPoller(TelegramBotApi api, TelegramTextHandoff handoff, int timeout, ChannelActivity activity, TelegramStore store, Recovery recovery) {
        this.store = store;
        this.recovery = recovery;
        this.activity = activity;
        this.api = api;
        this.handoff = handoff;
        this.timeout = timeout;
    }

    @FunctionalInterface
    interface Recovery {
        void run() throws InterruptedException;
    }

    void run() throws SQLException, InterruptedException {
        recovery.run();

        while (!Thread.currentThread().isInterrupted()) {
            try {
                var pending = store.nextTelegram();
                if (pending != null) {
                    handle(pending);
                    continue;
                }
                var updates = new java.util.ArrayList<tools.jackson.databind.JsonNode>();
                api.getUpdates(store.telegramOffset(), timeout).forEach(updates::add);
                store.saveTelegramBatch(updates, Instant.now());
                activity.succeeded();
                recovery.run();
                Thread.sleep(Duration.ofMillis(100));
            } catch (TelegramBotApi.RequestFailed failure) {
                activity.failed();
                LoggerFactory.getLogger(TelegramPoller.class).warn("Telegram polling or relay failed");
                Thread.sleep(Duration.ofSeconds(1));
            }
        }
    }
    private void handle(TelegramStore.QueuedTelegram pending) throws SQLException, InterruptedException {
        if (pending.nextAttemptAt() != null && pending.nextAttemptAt().isAfter(Instant.now())) {
            Thread.sleep(Duration.ofMillis(100));
            return;
        }
        try {
            handoff.process(JsonMapper.shared().readTree(pending.payload()));
            store.deleteTelegram(pending.event());
        } catch (TelegramBotApi.RequestFailed | tools.jackson.core.JacksonException failure) {
            store.failTelegram(pending.event(), Instant.now().plusSeconds(1));
        }
    }
}
