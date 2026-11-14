package com.inboxpoint.operations;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

import com.inboxpoint.operations.ChannelRuntime.ChannelStatus;
import com.inboxpoint.operations.ChannelRuntime.RuntimeStatus;
import com.inboxpoint.persistence.SqliteOperations;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class OperationsStatusController {
    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    private static final long STALE_SECONDS = 300;
    private final ChannelRuntime runtime;
    private final SqliteOperations repository;

    OperationsStatusController(ChannelRuntime runtime, SqliteOperations repository) {
        this.runtime = runtime;
        this.repository = repository;
    }

    @GetMapping("/api/ops/status")
    ResponseEntity<?> status() {
        try {
            var data = repository.snapshot();
            var activity = runtime.monitoringStatus();
            var control = runtime.control().state();
            var intake = control.path("channels");
            var outbound = control.path("delivery");
            var paused = "paused".equals(outbound.path("mode").asString());
            var maintenance = paused || "paused".equals(intake.at("/telegram/mode").asString())
                    || "paused".equals(intake.at("/vk/mode").asString());
            var now = activity.observedAt();
            var lastCycle = activity.lastWorkerCycle();
            var stalled = !activity.workerRunning()
                    || seconds(lastCycle == null ? activity.startedAt() : lastCycle, now) > STALE_SECONDS;
            var deliveryStatus = deliveryStatus(data, activity, stalled, paused);
            var counts = data.counts();
            var attention = stalled || !Set.of("healthy", "paused").contains(deliveryStatus.get("state"))
                    || needsAttention(activity.telegram()) || needsAttention(activity.vk())
                    || counts.recoverable() > 0 || counts.quarantined() > 0 || !data.operatorIncidents().isEmpty();
            return ResponseEntity.ok(Map.ofEntries(
                    Map.entry("channels", Map.of("telegram", channel(activity.telegram()), "vk", channel(activity.vk()))),
                    Map.entry("deliveries", deliveryStatus), Map.entry("intake", intake), Map.entry("outbound", outbound),
                    Map.entry("inboundEvents", Map.of("incidents", data.inboundIncidents(), "quarantined", counts.quarantined(),
                            "state", counts.quarantined() > 0 ? "quarantined" : "healthy")),
                    Map.entry("operatorInbox", Map.of("recoverableWebRequests", counts.recoverable(), "webOwnedRequests", counts.webOwned(),
                            "state", counts.recoverable() > 0 ? "attention" : "healthy")),
                    Map.entry("operatorRelays", Map.of("incidents", data.operatorIncidents(), "uncertain", counts.uncertain(),
                            "state", data.operatorIncidents().isEmpty() ? "healthy" : "uncertain")),
                    Map.entry("observedAt", TIMESTAMP.format(now)), Map.entry("startedAt", TIMESTAMP.format(activity.startedAt())),
                    Map.entry("state", attention ? "attention" : maintenance ? "maintenance" : "healthy"),
                    Map.entry("uptimeSeconds", seconds(activity.startedAt(), now))));
        } catch (SQLException | IOException failure) {
            return unavailable("Не удалось прочитать состояние сервиса.");
        }
    }

    @GetMapping("/api/ops/usage-metrics")
    ResponseEntity<?> usage() {
        var now = Instant.now();
        var since = now.minus(Duration.ofDays(30));
        try {
            return ResponseEntity.ok(Map.of("events", repository.usageCounts(since), "observedAt", TIMESTAMP.format(now),
                    "periodDays", 30, "recordedSince", TIMESTAMP.format(since)));
        } catch (SQLException failure) {
            return unavailable("Метрики пока недоступны.");
        }
    }

    private static Map<String, Object> deliveryStatus(SqliteOperations.Snapshot data, RuntimeStatus activity,
            boolean stalled, boolean paused) {
        var deliveries = data.deliveries();
        var result = new LinkedHashMap<String, Object>();
        var worker = new LinkedHashMap<String, Object>();
        worker.put("running", activity.workerRunning());
        worker.put("state", stalled ? "stalled" : "running");
        putTime(worker, "lastCycleAt", activity.lastWorkerCycle());
        result.put("worker", worker);
        result.put("failed", deliveries.failed());
        result.put("pending", deliveries.pending());
        result.put("uncertain", deliveries.uncertain());
        result.put("incidents", data.deliveryIncidents());
        long age = 0;
        if (deliveries.oldestPendingAt() != null) {
            age = seconds(Instant.parse(deliveries.oldestPendingAt()), activity.observedAt());
            result.put("oldestPendingAt", deliveries.oldestPendingAt());
            result.put("oldestPendingAgeSeconds", age);
        }
        var state = paused ? "paused" : stalled ? "stalled" : age > STALE_SECONDS ? "backlog"
                : deliveries.failed() > 0 ? "failed" : "healthy";
        result.put("state", state);
        return result;
    }

    private static boolean needsAttention(ChannelStatus channel) {
        return !"running".equals(channel.state()) && !"starting".equals(channel.state());
    }

    private static Map<String, Object> channel(ChannelStatus status) {
        var result = new LinkedHashMap<String, Object>();
        result.put("configured", status.configured());
        result.put("running", status.running());
        result.put("source", status.source());
        result.put("state", status.state());
        putTime(result, "lastSuccessfulPollAt", status.lastSuccessfulPollAt());
        putTime(result, "lastFailedPollAt", status.lastFailedPollAt());
        putTime(result, "lastRecoveredAt", status.lastRecoveredAt());
        if (status.lastFailure() != null) {
            var failure = status.lastFailure();
            result.put("lastFailure", failure.request() == null ? Map.of("stage", failure.stage())
                    : Map.of("stage", failure.stage(), "request", failure.request()));
        }
        if (status.lastFailedPollAt() != null || status.lastSuccessfulPollAt() != null) {
            result.put("consecutiveFailures", status.consecutiveFailures());
        }
        return result;
    }

    private static void putTime(Map<String, Object> result, String field, Instant value) {
        if (value != null) {
            result.put(field, TIMESTAMP.format(value));
        }
    }

    private static long seconds(Instant from, Instant to) {
        return Math.max(0, Duration.between(from, to).toSeconds());
    }

    private static ResponseEntity<Map<String, String>> unavailable(String message) {
        return ResponseEntity.status(503).body(Map.of("message", message));
    }
}
