package com.inboxpoint.operations;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import com.inboxpoint.admin.PasswordSessions;
import com.inboxpoint.telegram.TelegramRuntime;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
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
    private final OperationsAdmin admin;
    private final TelegramRuntime runtime;
    private final Instant started = Instant.now();

    OperationsController(OperationsAdmin admin, TelegramRuntime runtime) {
        this.admin = admin;
        this.runtime = runtime;
    }

    @GetMapping("/session")
    ResponseEntity<?> session(HttpServletRequest request, HttpServletResponse response) {
        return admin.available(request, response)
                ? ResponseEntity.ok(Map.of("authenticated", admin.authorized(request, response)))
                : message(404, "Not found");
    }

    @PostMapping("/login")
    ResponseEntity<?> login(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!PasswordSessions.sameOrigin(request)) {
            return message(403, "Запрос отклонён.");
        }
        if (admin.authorized(request, response)) {
            return ResponseEntity.ok(Map.of("authenticated", true));
        }
        var result = admin.login(input.path("password").asString(""), request.getRemoteAddr());
        if (result.retryAfter() > 0) {
            return ResponseEntity.status(429).header(HttpHeaders.RETRY_AFTER, Long.toString(result.retryAfter()))
                    .body(Map.of("message", "Слишком много попыток. Попробуйте позже."));
        }
        if (result.token() == null) {
            return message(401, "Неверный пароль.");
        }
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, admin.cookie(result.token(), true))
                .body(Map.of("authenticated", true));
    }

    @PostMapping("/logout")
    ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!PasswordSessions.sameOrigin(request)) {
            return message(403, "Запрос отклонён.");
        }
        admin.logout(request);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, admin.cookie("", false))
                .body(Map.of("authenticated", false));
    }

    @GetMapping("/status")
    ResponseEntity<?> status(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return message(401, "Введите пароль мониторинга.");
        }
        try {
            var now = Instant.now();
            var telegram = ChannelState.observe(runtime.status(), runtime.telegramPolling(), started, now);
            var vk = ChannelState.observe(runtime.vkStatus(), runtime.vkPolling(), started, now);
            var delivery = runtime.deliveryState(now);
            boolean attention = !"healthy".equals(delivery.state()) && !"paused".equals(delivery.state())
                    || telegram.needsAttention() || vk.needsAttention();
            var control = runtime.serviceControl().current();
            var intake = control.channels();
            boolean maintenance = "paused".equals(control.delivery().mode())
                    || intake.values().stream().anyMatch(item -> "paused".equals(item.mode()));
            return ResponseEntity.ok(Map.of(
                    "state", attention ? "attention" : maintenance ? "maintenance" : "healthy",
                    "channels", Map.of("telegram", telegram, "vk", vk),
                    "deliveries", delivery, "intake", intake, "outbound", control.delivery(), "observedAt", now.toString(), "startedAt", started.toString(),
                    "uptimeSeconds", Math.max(0, Duration.between(started, now).toSeconds())));
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
            return message(401, "Введите пароль мониторинга.");
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

    private ResponseEntity<?> deliveryAccess(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return message(401, "Введите пароль мониторинга.");
        }
        return PasswordSessions.sameOrigin(request) ? null : message(403, "Запрос отклонён.");
    }

    boolean isReady() throws IOException, SQLException {
        var now = Instant.now();
        var delivery = runtime.deliveryState(now);
        return !"stalled".equals(delivery.state()) && !"backlog".equals(delivery.state())
                && ChannelState.observe(runtime.status(), runtime.telegramPolling(), started, now).ready()
                && ChannelState.observe(runtime.vkStatus(), runtime.vkPolling(), started, now).ready();
    }

    private static ResponseEntity<Map<String, String>> message(int status, String text) {
        return ResponseEntity.status(status).body(Map.of("message", text));
    }

}
