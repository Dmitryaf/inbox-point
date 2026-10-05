package com.inboxpoint.operations;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class ChannelDiagnosticsTest {
    @Test
    void reportsOnlyStructuredDiagnosticsAndRecordsRecovery() {
        var now = Instant.parse("2026-10-05T08:00:00Z");
        var activity = new ChannelActivity(Clock.fixed(now, ZoneOffset.UTC));
        var diagnostic = ApiFailure.describe("telegram", "getMe", "http", System.nanoTime(), 401, null, null);
        activity.failed("startup", new ApiFailure("Synthetic sensitive message", diagnostic));
        assertThat(activity.snapshot().consecutiveFailures()).isEqualTo(1);
        var serialized = JsonMapper.shared().valueToTree(activity.snapshot().lastFailure()).toString();
        assertThat(serialized).contains("getMe", "startup", "401").doesNotContain("Synthetic sensitive message");
        activity.succeeded();
        assertThat(activity.snapshot().lastRecoveredAt()).isEqualTo(now);
        assertThat(activity.snapshot().consecutiveFailures()).isZero();
    }
}
