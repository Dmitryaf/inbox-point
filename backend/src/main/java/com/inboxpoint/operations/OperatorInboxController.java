package com.inboxpoint.operations;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

import com.inboxpoint.admin.AdminSessions;
import com.inboxpoint.admin.PasswordSessions;
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
@RequestMapping("/api/ops/inbox/requests")
final class OperatorInboxController {
    private final AdminSessions admin;
    private final TelegramRuntime runtime;

    OperatorInboxController(AdminSessions admin, TelegramRuntime runtime) {
        this.admin = admin;
        this.runtime = runtime;
    }

    @GetMapping
    ResponseEntity<?> requests(HttpServletRequest request, HttpServletResponse response) {
        var denied = access(request, response, false);
        if (denied != null) {
            return denied;
        }
        try {
            return ResponseEntity.ok(Map.of("requests", runtime.inboxRequests()));
        } catch (IOException | SQLException failure) {
            return unavailable();
        }
    }

    @GetMapping("/{id}/messages")
    ResponseEntity<?> messages(@PathVariable String id, HttpServletRequest request, HttpServletResponse response) {
        var denied = access(request, response, false);
        if (denied != null) {
            return denied;
        }
        if (id.length() > 100) {
            return missing();
        }
        try {
            var messages = runtime.inboxMessages(id);
            return messages == null ? missing() : ResponseEntity.ok(Map.of("messages", messages));
        } catch (IOException | SQLException failure) {
            return unavailable();
        }
    }

    @PostMapping("/{id}/{operation:replies|close}")
    ResponseEntity<?> action(@PathVariable String id, @PathVariable String operation,
            @RequestBody(required = false) JsonNode body, HttpServletRequest request, HttpServletResponse response)
            throws InterruptedException {
        var denied = access(request, response, true);
        if (denied != null) {
            return denied;
        }
        var close = "close".equals(operation);
        var key = body == null ? "" : body.path("idempotencyKey").asString("");
        var text = body == null ? "" : body.path("text").asString("").strip();
        if (id.length() > 100 || !key.matches("[A-Za-z0-9_-]{1,100}")
                || !close && (text.isEmpty() || text.length() > 4000)) {
            return message(400, close ? "Не удалось закрыть обращение." : "Введите ответ длиной до 4000 символов.");
        }
        try {
            return switch (runtime.inboxAction(id, key, text, close)) {
                case "missing" -> missing();
                case "closed" -> message(409, "Обращение уже закрыто.");
                default -> ResponseEntity.ok(Map.of(close ? "closed" : "queued", true));
            };
        } catch (IOException | SQLException failure) {
            return unavailable();
        }
    }

    private ResponseEntity<?> access(HttpServletRequest request, HttpServletResponse response, boolean write) {
        if (!admin.available(request, response)) {
            return message(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return message(401, "Введите пароль мониторинга.");
        }
        return write && !PasswordSessions.sameOrigin(request) ? message(403, "Запрос отклонён.") : null;
    }

    private static ResponseEntity<?> missing() {
        return message(404, "Обращение не найдено.");
    }

    private static ResponseEntity<?> unavailable() {
        return message(500, "Не удалось выполнить действие. Попробуйте ещё раз.");
    }

    private static ResponseEntity<Map<String, String>> message(int status, String text) {
        return ResponseEntity.status(status).body(Map.of("message", text));
    }
}
