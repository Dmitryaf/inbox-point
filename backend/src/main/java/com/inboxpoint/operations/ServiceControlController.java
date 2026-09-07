package com.inboxpoint.operations;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

import com.inboxpoint.admin.PasswordSessions;
import com.inboxpoint.telegram.TelegramRuntime;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ops/service-control")
final class ServiceControlController {
    private final OperationsAdmin operations;
    private final LocalServiceControl control;

    ServiceControlController(OperationsAdmin operations, TelegramRuntime runtime) {
        this.operations = operations;
        control = runtime.serviceControl();
    }

    @GetMapping
    ResponseEntity<?> current(HttpServletRequest request, HttpServletResponse response) {
        var error = access(request, response);
        return error == null ? ResponseEntity.ok(control.current()) : error;
    }

    @PostMapping("/{channel}/{command:pause|resume}")
    ResponseEntity<?> set(@PathVariable String channel, @PathVariable String command,
            HttpServletRequest request, HttpServletResponse response) {
        var error = access(request, response);
        if (error != null) {
            return error;
        }
        if (!PasswordSessions.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        try {
            var paused = "pause".equals(command);
            if ("delivery".equals(channel) && request.getRequestURI().startsWith("/api/ops/")) {
                return ResponseEntity.ok(control.setDelivery(paused, Instant.now()));
            }
            return ResponseEntity.ok(control.set(channel, paused, Instant.now()));
        } catch (IllegalArgumentException unknown) {
            return error(404, "Канал не найден.");
        } catch (IOException failure) {
            if ("delivery".equals(channel)) {
                return error(500, "pause".equals(command) ? "Не удалось остановить исходящую доставку."
                        : "Не удалось возобновить исходящую доставку.");
            }
            return error(500, "Не удалось изменить приём новых обращений.");
        }
    }

    private ResponseEntity<?> access(HttpServletRequest request, HttpServletResponse response) {
        var admin = operations;
        if (!admin.available(request, response)) {
            return error(404, "Not found");
        }
        return admin.authorized(request, response) ? null : error(401, "Введите пароль управления.");
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }
}
