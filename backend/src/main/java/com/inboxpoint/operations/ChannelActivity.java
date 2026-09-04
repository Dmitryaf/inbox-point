package com.inboxpoint.operations;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

public final class ChannelActivity {
    private final Clock clock;
    private final AtomicReference<Snapshot> state = new AtomicReference<>(new Snapshot(null, null));

    public ChannelActivity() {
        this(Clock.systemUTC());
    }

    ChannelActivity(Clock clock) {
        this.clock = clock;
    }

    public void succeeded() {
        var now = clock.instant();
        state.updateAndGet(previous -> new Snapshot(previous.lastFailed(), now));
    }

    public void failed() {
        var now = clock.instant();
        state.updateAndGet(previous -> new Snapshot(now, previous.lastSucceeded()));
    }

    public Snapshot snapshot() {
        return state.get();
    }

    public record Snapshot(Instant lastFailed, Instant lastSucceeded) {
        boolean failedSinceSuccess() {
            return lastFailed != null && (lastSucceeded == null || lastFailed.isAfter(lastSucceeded));
        }
    }
}
