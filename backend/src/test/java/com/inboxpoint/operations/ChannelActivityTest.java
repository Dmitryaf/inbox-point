package com.inboxpoint.operations;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import com.inboxpoint.telegram.TelegramRuntime;
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

    @Test
    void distinguishesOptionalChannelsFromChannelsWithStaleOrFailedPolling() {
        var start = Instant.parse("2026-09-01T10:00:00Z");
        var none = new ChannelActivity.Snapshot(null, null);
        var configured = new TelegramRuntime.Status(true, true, "environment");
        assertThat(ChannelState.observe(new TelegramRuntime.Status(false, false, "none"), none, start,
                start.plusSeconds(130)).ready()).isTrue();
        assertThat(ChannelState.observe(configured, none, start, start.plusSeconds(30)).state()).isEqualTo("starting");
        var stale = ChannelState.observe(configured, none, start, start.plusSeconds(130));
        assertThat(stale.state()).isEqualTo("poll_stale");
        assertThat(stale.ready()).isFalse();
        var failed = ChannelState.observe(configured, new ChannelActivity.Snapshot(start.plusSeconds(2), start),
                start, start.plusSeconds(3));
        assertThat(failed.ready()).isFalse();
        assertThat(failed.state()).isEqualTo("poll_failed");
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
