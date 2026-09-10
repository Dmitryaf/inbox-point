package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

import com.inboxpoint.admin.AdminSessions;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/setup")
final class TelegramSetupController {
    private final TelegramRuntime runtime;
    private final AdminSessions admin;

    TelegramSetupController(TelegramRuntime runtime, AdminSessions admin) {
        this.admin = admin;
        this.runtime = runtime;
    }

    @GetMapping("/status")
    ResponseEntity<?> status(HttpServletRequest request, HttpServletResponse response) {
        var denied = setupAccess(request, response, false);
        if (denied != null) {
            return denied;
        }
        var status = runtime.status();
        return ResponseEntity.ok(Map.of("connected", status.connected(), "locked", status.locked(),
                "source", status.source(), "vk", runtime.vkStatus()));
    }

    @PostMapping("/telegram/discover")
    ResponseEntity<?> discover(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        var denied = setupAccess(request, response, true);
        if (denied != null) {
            return denied;
        }
        try {
            return ResponseEntity.ok(Map.of("chats", runtime.discover(input.path("botToken").asString(""))));
        } catch (IOException | IllegalStateException | IllegalArgumentException failure) {
            return error(400, explanation(failure));
        } catch (InterruptedException stopped) {
            Thread.currentThread().interrupt();
            return error(503, "Подключение прервано. Попробуйте снова.");
        }
    }

    @PostMapping("/telegram/connect")
    ResponseEntity<?> connect(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        var denied = setupAccess(request, response, true);
        if (denied != null) {
            return denied;
        }
        var group = input.path("operatorChatId");
        if (!group.isIntegralNumber() || !group.canConvertToLong() || group.longValue() >= 0
                || group.longValue() <= -(1L << 53)) {
            return error(400, "Проверьте токен и группу.");
        }
        try {
            runtime.connect(input.path("botToken").asString(""), group.longValue());
            return ResponseEntity.ok(Map.of("connected", true));
        } catch (IOException | SQLException | IllegalStateException | IllegalArgumentException failure) {
            return error(400, explanation(failure));
        } catch (InterruptedException stopped) {
            Thread.currentThread().interrupt();
            return error(503, "Подключение прервано. Попробуйте снова.");
        }
    }

    @PostMapping("/vk/connect")
    ResponseEntity<?> connectVk(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        var denied = setupAccess(request, response, true);
        if (denied != null) {
            return denied;
        }
        if (!runtime.status().connected()) {
            return error(409, "Сначала подключите Telegram.");
        }
        try {
            runtime.connectVk(input.path("accessToken").asString(""), input.path("community").asString(""));
            return ResponseEntity.ok(Map.of("connected", true));
        } catch (IOException failure) {
            return error(400, "Не удалось подключить VK. Проверьте токен, сообщество и настройки сообщений.");
        } catch (IllegalStateException | IllegalArgumentException failure) {
            return error(400, failure.getMessage());
        } catch (InterruptedException stopped) {
            Thread.currentThread().interrupt();
            return error(503, "Подключение прервано. Попробуйте снова.");
        }
    }

    @DeleteMapping("/{channel:telegram|vk}")
    ResponseEntity<?> disconnect(@PathVariable String channel, HttpServletRequest request, HttpServletResponse response)
            throws InterruptedException {
        var denied = setupAccess(request, response, true);
        if (denied != null) {
            return denied;
        }
        var telegram = "telegram".equals(channel);
        try {
            if (telegram) {
                runtime.disconnectTelegram();
            } else {
                runtime.disconnectVk();
            }
            return ResponseEntity.ok(Map.of("connected", false));
        } catch (IllegalStateException blocked) {
            return error(409, blocked.getMessage());
        } catch (IOException failed) {
            return error(500, "Не удалось отключить " + (telegram ? "Telegram." : "VK."));
        }
    }

    private ResponseEntity<?> setupAccess(HttpServletRequest request, HttpServletResponse response, boolean write) {
        if (!admin.available(request, response)) {
            return error(404, "Not found");
        }
        if (!admin.authorized(request, response)) {
            return error(401, "Войдите, чтобы продолжить.");
        }
        return write && !admin.sameOrigin(request) ? error(403, "Запрос отклонён.") : null;
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }

    private static String explanation(Exception failure) {
        var message = failure.getMessage() == null ? "" : failure.getMessage();
        if (message.contains("supergroup")) {
            return "Включите в выбранной группе темы и попробуйте снова.";
        }
        if (message.contains("can_manage_topics")) {
            return "Разрешите боту управлять темами группы.";
        }
        if (message.contains("administrator")) {
            return "Назначьте бота администратором выбранной группы.";
        }
        if (message.contains("webhook")) {
            return "У бота уже настроена другая интеграция. Отключите её или создайте отдельного бота.";
        }
        if (message.contains("already connected")) {
            return "Telegram уже подключён.";
        }
        if (message.contains("managed by server")) {
            return "Эта настройка управляется сервером.";
        }
        if (message.contains("token format")) {
            return "Введите корректный токен бота.";
        }
        return "Не удалось подключиться. Проверьте токен, группу и права бота.";
    }
}
