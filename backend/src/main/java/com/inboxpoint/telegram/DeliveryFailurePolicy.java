package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;

final class DeliveryFailurePolicy {
    private static final int ATTEMPT_LIMIT = 5;
    private final TelegramStore store;
    private final Clock clock;

    DeliveryFailurePolicy(TelegramStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    void record(TelegramStore.Pending item, IOException failure) throws SQLException {
        var telegram = failure instanceof TelegramBotApi.RequestFailed rejected ? rejected : null;
        var uncertain = telegram != null && telegram.outcomeUnknown();
        var diagnostic = telegram == null ? null : telegram.diagnostic();
        var reason = diagnostic != null && diagnostic.apiCode() != null ? "API " + diagnostic.apiCode() : "Transport";
        if (uncertain || item.attempts() + 1 >= ATTEMPT_LIMIT) {
            store.failed(item.key(), uncertain, reason);
            store.pilotEvent("delivery-failure:" + item.key(), "delivery_failure", item.channel(), item.request(), clock.instant());
        } else {
            long delay = Math.min(5L << item.attempts(), 300);
            store.schedule(item.key(), clock.instant().plusSeconds(delay));
        }
    }
}
