package com.inboxpoint.operations;

import java.time.Duration;
import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.inboxpoint.telegram.TelegramRuntime;

@JsonInclude(JsonInclude.Include.NON_NULL)
record ChannelState(boolean configured, boolean running, String source, String state,
        String lastFailedPollAt, String lastSuccessfulPollAt) {
    private static final Duration STALE_AFTER = Duration.ofMinutes(2);

    static ChannelState observe(TelegramRuntime.Status setup, ChannelActivity.Snapshot polling,
            Instant started, Instant now) {
        var configured = !setup.source().equals("none");
        String state;
        if (!configured) {
            state = "not_configured";
        } else if (polling.failedSinceSuccess()) {
            state = "poll_failed";
        } else if (!setup.connected()) {
            state = "stopped";
        } else if (polling.lastSucceeded() == null) {
            state = stale(started, now) ? "poll_stale" : "starting";
        } else {
            state = stale(polling.lastSucceeded(), now) ? "poll_stale" : "running";
        }
        return new ChannelState(configured, setup.connected(), setup.source(), state,
                polling.lastFailed() == null ? null : polling.lastFailed().toString(),
                polling.lastSucceeded() == null ? null : polling.lastSucceeded().toString());
    }

    boolean ready() {
        return "not_configured".equals(state) || "running".equals(state) || "starting".equals(state);
    }

    boolean needsAttention() {
        return !"running".equals(state) && !"starting".equals(state);
    }

    private static boolean stale(Instant value, Instant now) {
        return Duration.between(value, now).compareTo(STALE_AFTER) > 0;
    }
}
