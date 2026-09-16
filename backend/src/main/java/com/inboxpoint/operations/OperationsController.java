package com.inboxpoint.operations;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import com.inboxpoint.admin.AdminSessions;
import com.inboxpoint.telegram.TelegramRuntime;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/ops")
final class OperationsController {
    private final AdminSessions admin;
    private final TelegramRuntime runtime;
    private final Instant started = Instant.now();

    OperationsController(AdminSessions admin, TelegramRuntime runtime) {
        this.admin = admin;
        this.runtime = runtime;
    }

    @GetMapping("/status")
    ResponseEntity<?> status(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return message(401, "Войдите, чтобы продолжить.");
        }
        try {
            var now = Instant.now();
            var telegram = ChannelState.observe(runtime.status(), runtime.telegramPolling(), started, now);
            var vk = ChannelState.observe(runtime.vkStatus(), runtime.vkPolling(), started, now);
            var delivery = runtime.deliveryState(now);
            var operatorRelays = runtime.operatorRelayStatus();
            var inboundEvents = runtime.inboundStatus();
            var webRequests = runtime.openWebRequests();
            boolean attention = !"healthy".equals(delivery.state()) && !"paused".equals(delivery.state())
                    || "stalled".equals(delivery.worker().state()) || telegram.needsAttention() || vk.needsAttention() || operatorRelays.uncertain() > 0 || inboundEvents.quarantined() > 0 || webRequests > 0;
            var control = runtime.serviceControl().current();
            var intake = control.channels();
            boolean maintenance = "paused".equals(control.delivery().mode())
                    || intake.values().stream().anyMatch(item -> "paused".equals(item.mode()));
            return ResponseEntity.ok(Map.ofEntries(
                    Map.entry("state", attention ? "attention" : maintenance ? "maintenance" : "healthy"),
                    Map.entry("channels", Map.of("telegram", telegram, "vk", vk)),
                    Map.entry("deliveries", delivery), Map.entry("operatorRelays", operatorRelays),
                    Map.entry("inboundEvents", inboundEvents), Map.entry("intake", intake),
                    Map.entry("outbound", control.delivery()), Map.entry("observedAt", now.toString()),
                    Map.entry("startedAt", started.toString()),
                    Map.entry("operatorInbox", Map.of("activeWebRequests", webRequests, "state", webRequests > 0 ? "attention" : "healthy")),
                    Map.entry("uptimeSeconds", Math.max(0, Duration.between(started, now).toSeconds()))));
        } catch (IOException | SQLException unavailable) {
            return message(503, "Не удалось прочитать состояние сервиса.");
        }
    }

    @GetMapping("/usage-metrics")
    ResponseEntity<?> usageMetrics(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return message(401, "Войдите, чтобы продолжить.");
        }
        try {
            var now = Instant.now();
            var since = now.minus(Duration.ofDays(30));
            return ResponseEntity.ok(Map.of("events", runtime.usageCounts(since), "observedAt", now.toString(),
                    "recordedSince", since.toString(), "periodDays", 30));
        } catch (IOException | SQLException unavailable) {
            return message(503, "Метрики пока недоступны.");
        }
    }

    @PostMapping("/deliveries/{id}/retry")
    ResponseEntity<?> retryDelivery(@PathVariable String id, HttpServletRequest request, HttpServletResponse response) {
        var denied = deliveryAccess(request, response);
        if (denied != null) {
            return denied;
        }
        if (id.length() > 100) {
            return message(404, "Ответ не найден.");
        }
        try {
            if (!runtime.retry(id)) {
                return message(409, "Ответ уже отправляется, больше не требует повтора или нуждается в ручной проверке.");
            }
            return ResponseEntity.ok(Map.of("queued", true));
        } catch (IOException | SQLException unavailable) {
            return message(503, "Управление доставкой пока недоступно.");
        }
    }

    @PostMapping("/deliveries/{id}/resolve")
    ResponseEntity<?> resolveDelivery(@PathVariable String id, @RequestBody(required = false) JsonNode input,
            HttpServletRequest request, HttpServletResponse response) {
        var denied = deliveryAccess(request, response);
        if (denied != null) {
            return denied;
        }
        var choice = input == null ? "" : input.path("resolution").asString("");
        var received = "received".equals(choice);
        if (id.length() > 100 || !received && !"not_received".equals(choice)) {
            return message(400, "Не удалось уточнить доставку.");
        }
        try {
            if (!runtime.resolve(id, received)) {
                return message(409, "Ответ уже обработан или не требует ручной проверки.");
            }
            return ResponseEntity.ok(Map.of("queued", !received, "resolved", true));
        } catch (IOException | SQLException unavailable) {
            return message(503, "Управление доставкой пока недоступно.");
        }
    }

    @PostMapping("/operator-actions/{id}/resolve")
    ResponseEntity<?> resolveOperatorAction(@PathVariable String id, @RequestBody(required = false) JsonNode input,
            HttpServletRequest request, HttpServletResponse response) {
        var denied = deliveryAccess(request, response);
        if (denied != null) {
            return denied;
        }
        var choice = input == null ? "" : input.path("resolution").asString("");
        if (id.length() > 500 || !java.util.Set.of("received", "use_web", "completed", "not_completed", "retry").contains(choice)) {
            return message(400, "Не удалось уточнить передачу обращения.");
        }
        try {
            if (!runtime.resolveOperatorAction(id, choice)) {
                return message(409, "Инцидент уже обработан или выбранное действие недоступно.");
            }
            return ResponseEntity.ok(Map.of("resolved", true));
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
            return message(503, "Приложение останавливается.");
        } catch (IOException | SQLException unavailable) {
            return message(503, "Управление передачей обращений недоступно.");
        }
    }

    @PostMapping("/inbound-events/{id}/resolve")
    ResponseEntity<?> resolveInboundEvent(@PathVariable String id, @RequestBody(required = false) JsonNode input,
            HttpServletRequest request, HttpServletResponse response) {
        var denied = deliveryAccess(request, response);
        if (denied != null) {
            return denied;
        }
        var source = input == null ? "" : input.path("source").asString("");
        var choice = input == null ? "" : input.path("resolution").asString("");
        var retry = "retry".equals(choice);
        if (id.length() > 500 || !java.util.Set.of("vk:long-poll", "telegram:get-updates").contains(source) || !retry && !"skip".equals(choice)) {
            return message(400, "Не удалось обработать входящее событие.");
        }
        try {
            if (!runtime.resolveInbound(source, id, retry)) {
                return message(409, "Инцидент уже обработан.");
            }
            return ResponseEntity.ok(Map.of("resolved", true));
        } catch (IOException | SQLException unavailable) {
            return message(503, "Управление входящими событиями недоступно.");
        }
    }

    private ResponseEntity<?> deliveryAccess(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return message(401, "Войдите, чтобы продолжить.");
        }
        return admin.sameOrigin(request) ? null : message(403, "Запрос отклонён.");
    }

    boolean isReady() throws IOException, SQLException {
        var now = Instant.now();
        var delivery = runtime.deliveryState(now);
        return "running".equals(delivery.worker().state()) && !"stalled".equals(delivery.state()) && !"backlog".equals(delivery.state())
                && runtime.operatorRelayStatus().uncertain() == 0 && runtime.inboundStatus().quarantined() == 0 && runtime.openWebRequests() == 0
                && ChannelState.observe(runtime.status(), runtime.telegramPolling(), started, now).ready()
                && ChannelState.observe(runtime.vkStatus(), runtime.vkPolling(), started, now).ready();
    }

    private static ResponseEntity<Map<String, String>> message(int status, String text) {
        return ResponseEntity.status(status).body(Map.of("message", text));
    }

}
