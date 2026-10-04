package com.inboxpoint.telegram;

import java.nio.file.Path;
import java.time.Instant;

import com.inboxpoint.content.ClientInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class UsageAnalyticsTest {
    @TempDir
    Path directory;

    @Test
    void groupsMenuActionsByStableIdentityAndKeepsDatesWithNoTraffic() throws Exception {
        var now = Instant.parse("2026-10-04T15:00:00Z");
        try (var store = new TelegramStore(directory.resolve("usage.sqlite"))) {
            store.usageEvent("request-a", "new_request", "vk", null, now);
            store.usageEvent("legacy", "information_section", "vk", null, now);
            store.recordMenuAction("one", "vk", new ClientInformation.MenuAction("custom:stable", "Previous label"), now.minusSeconds(20));
            store.recordMenuAction("two", "vk", new ClientInformation.MenuAction("custom:stable", "Latest label"), now);
            store.recordMenuAction("three", "telegram", new ClientInformation.MenuAction("handoff", "Задать вопрос"), now);
            var report = store.usageReport(7, "vk", now);
            assertThat(report.daily()).hasSize(7);
            assertThat(report.summary().requests()).isEqualTo(1);
            assertThat(report.summary().menuActions()).isEqualTo(3);
            assertThat(report.actions().getFirst().label()).isEqualTo("Latest label");
        }
    }
}
