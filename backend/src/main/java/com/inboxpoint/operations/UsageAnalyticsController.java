package com.inboxpoint.operations;

import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import com.inboxpoint.persistence.SqliteUsageAnalytics;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class UsageAnalyticsController {
    private static final Map<String, Integer> PERIODS = Map.of("7d", 7, "30d", 30, "90d", 90);
    private static final Set<String> CHANNELS = Set.of("all", "telegram", "vk");
    private static final Set<String> QUERY_FIELDS = Set.of("period", "channel");
    private final SqliteUsageAnalytics analytics;

    UsageAnalyticsController(SqliteUsageAnalytics analytics) {
        this.analytics = analytics;
    }

    @GetMapping("/api/analytics")
    ResponseEntity<?> report(@RequestParam MultiValueMap<String, String> query) {
        if (!QUERY_FIELDS.containsAll(query.keySet()) || query.values().stream().anyMatch(value -> value.size() != 1)) {
            return invalidQuery();
        }
        var days = PERIODS.get(query.containsKey("period") ? query.getFirst("period") : "30d");
        var channel = query.containsKey("channel") ? query.getFirst("channel") : "all";
        if (days == null || !CHANNELS.contains(channel)) {
            return invalidQuery();
        }
        try {
            return ResponseEntity.ok(analytics.report(days, channel, Instant.now()));
        } catch (SQLException unavailable) {
            return ResponseEntity.status(503).body(Map.of("message", "Не удалось загрузить аналитику. Попробуйте ещё раз."));
        }
    }

    private static ResponseEntity<Map<String, String>> invalidQuery() {
        return ResponseEntity.badRequest().body(Map.of("message", "Выберите период и канал из списка."));
    }
}
