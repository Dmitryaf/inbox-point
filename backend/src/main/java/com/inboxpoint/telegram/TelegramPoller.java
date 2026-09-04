package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Duration;

import com.inboxpoint.operations.ChannelActivity;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;

final class TelegramPoller {
    private final TelegramBotApi api;
    private final TelegramTextHandoff handoff;
    private final int timeout;
    private final ChannelActivity activity;

    TelegramPoller(TelegramBotApi api, TelegramTextHandoff handoff, int timeout, ChannelActivity activity) {
        this.activity = activity;
        this.api = api;
        this.handoff = handoff;
        this.timeout = timeout;
    }

    void run() throws SQLException, InterruptedException {
        Long next = null;
        while (!Thread.currentThread().isInterrupted()) {
            try {
                for (JsonNode update : api.getUpdates(next, timeout)) {
                    handoff.process(update);
                    var offset = update.path("update_id").asLong() + 1;
                    next = next == null ? offset : Math.max(next, offset);
                }
                activity.succeeded();
                Thread.sleep(Duration.ofMillis(100));
            } catch (TelegramBotApi.RequestFailed failure) {
                activity.failed();
                LoggerFactory.getLogger(TelegramPoller.class).warn("Telegram polling or relay failed");
                Thread.sleep(Duration.ofSeconds(1));
            }
        }
    }
}
