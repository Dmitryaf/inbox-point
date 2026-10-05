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
        state.updateAndGet(previous -> new Snapshot(previous.lastFailed(), now, 0, previous.lastFailure(),
                previous.consecutiveFailures() == 0 ? previous.lastRecoveredAt() : now));
    }

    public void failed() {
        failed("poll", null);
    }

    public void failed(String stage, Throwable failure) {
        var now = clock.instant();
        var diagnostic = failure instanceof ApiFailure api ? api.diagnostic() : null;
        state.updateAndGet(previous -> new Snapshot(now, previous.lastSucceeded(), previous.consecutiveFailures() + 1,
                new Failure(stage, diagnostic), previous.lastRecoveredAt()));
        if (diagnostic != null) {
            var logger = org.slf4j.LoggerFactory.getLogger(ChannelActivity.class);
            logger.warn("Channel API unavailable channel={} stage={} method={} kind={} operation={} durationMs={} httpStatus={} apiCode={} transportCodes={}",
                    diagnostic.channel(), stage, diagnostic.method(), diagnostic.kind(), diagnostic.operationId(),
                    diagnostic.durationMs(), diagnostic.httpStatus(), diagnostic.apiCode(), diagnostic.transportCodes());
        }
    }

    public Snapshot snapshot() {
        return state.get();
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record Failure(String stage, ApiFailure.Diagnostic request) { }

    public record Snapshot(Instant lastFailed, Instant lastSucceeded, int consecutiveFailures,
            Failure lastFailure, Instant lastRecoveredAt) {
        public Snapshot(Instant lastFailed, Instant lastSucceeded) { this(lastFailed, lastSucceeded, 0, null, null); }

        boolean failedSinceSuccess() {
            return consecutiveFailures > 0 || lastFailed != null && (lastSucceeded == null || lastFailed.isAfter(lastSucceeded));
        }
    }
}
