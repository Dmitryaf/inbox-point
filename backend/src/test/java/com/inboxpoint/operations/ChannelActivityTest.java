package com.inboxpoint.operations;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ChannelActivityTest {
    @Test
    void retainsTheFailedPollWhenAChannelRecovers() {
        var time = new MutableClock();
        var activity = new ChannelActivity(time);
        assertThat(activity.snapshot().failedSinceSuccess()).isFalse();
        activity.failed();
        var failed = activity.snapshot();
        assertThat(failed.failedSinceSuccess()).isTrue();
        time.now = time.now.plusSeconds(20);
        activity.succeeded();
        var recovered = activity.snapshot();
        assertThat(recovered.failedSinceSuccess()).isFalse();
        assertThat(recovered.lastFailed()).isEqualTo(failed.lastFailed());
        assertThat(recovered.lastSucceeded()).isEqualTo(time.now);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-09-01T10:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return Clock.fixed(now, zone);
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
