package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

import com.inboxpoint.operations.LocalSetupAccess;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/setup")
final class TelegramSetupController {
    private final TelegramRuntime runtime;
    private final boolean development;

    TelegramSetupController(TelegramRuntime runtime, @Value("${INBOXPOINT_ENV:development}") String environment) {
        development = !"production".equals(environment);
        this.runtime = runtime;
    }

    @GetMapping("/status")
    ResponseEntity<?> status(HttpServletRequest request, HttpServletResponse response) {
        return development && LocalSetupAccess.allow(request, response)
                ? ResponseEntity.ok(Map.of("connected", runtime.status().connected(), "locked", runtime.status().locked(),
                        "source", runtime.status().source(), "vk", runtime.vkStatus())) : error(404, "Not found");
    }

    @PostMapping("/telegram/discover")
    ResponseEntity<?> discover(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!development || !LocalSetupAccess.allow(request, response)) {
            return error(404, "Not found");
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
        if (!development || !LocalSetupAccess.allow(request, response)) {
            return error(404, "Not found");
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
        if (!development || !LocalSetupAccess.allow(request, response)) {
            return error(404, "Not found");
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

    @GetMapping("/deliveries")
    ResponseEntity<?> deliveries(HttpServletRequest request, HttpServletResponse response) {
        if (!development || !LocalSetupAccess.allow(request, response)) {
            return error(404, "Not found");
        }
        try {
            return ResponseEntity.ok(runtime.deliveryStatus());
        } catch (IOException | SQLException failure) {
            return error(503, "Не удалось проверить доставку.");
        }
    }

    @PostMapping("/deliveries/retry")
    ResponseEntity<?> retry(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!development || !LocalSetupAccess.allow(request, response)) {
            return error(404, "Not found");
        }
        try {
            return runtime.retry(input.path("deliveryId").asString(""))
                    ? ResponseEntity.ok(Map.of("queued", true))
                    : error(409, "Ответ недоступен для повторной отправки. Обновите страницу.");
        } catch (IOException | SQLException failure) {
            return error(503, "Не удалось повторить отправку.");
        }
    }

    @PostMapping("/backups")
    ResponseEntity<?> backup(HttpServletRequest request, HttpServletResponse response) {
        if (!development || !LocalSetupAccess.allow(request, response)) {
            return error(404, "Not found");
        }
        try {
            return ResponseEntity.ok(runtime.backup());
        } catch (IOException | SQLException failure) {
            return error(503, "Не удалось создать резервную копию.");
        }
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
