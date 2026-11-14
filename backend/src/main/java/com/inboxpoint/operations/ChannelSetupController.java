package com.inboxpoint.operations;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/setup")
class ChannelSetupController {
    private final ChannelRuntime runtime;

    ChannelSetupController(ChannelRuntime runtime) {
        this.runtime = runtime;
    }

    @GetMapping("/status")
    Map<String, Object> status() {
        var telegram = status(runtime.status("telegram"));
        telegram.put("vk", status(runtime.status("vk")));
        return telegram;
    }

    @PostMapping("/telegram/discover")
    ResponseEntity<?> discover(@RequestBody(required = false) JsonNode input) {
        var token = string(input, "botToken");
        if (!length(token, 20, 200)) {
            return error(400, "Введите корректный токен бота.");
        }
        try {
            return ResponseEntity.ok(Map.of("chats", runtime.discoverTelegram(token)));
        } catch (Exception failure) {
            return connectionError("telegram", failure);
        }
    }

    @PostMapping("/telegram/connect")
    ResponseEntity<?> connectTelegram(@RequestBody(required = false) JsonNode input) {
        var token = string(input, "botToken");
        var chat = input == null ? null : input.path("operatorChatId");
        if (!length(token, 20, 200) || chat == null || !chat.isIntegralNumber() || !chat.canConvertToLong()
                || chat.longValue() >= 0 || chat.longValue() <= -(1L << 53)) {
            return error(400, "Проверьте токен и группу.");
        }
        try {
            runtime.connectTelegram(token, chat.longValue());
            return ResponseEntity.ok(Map.of("connected", true));
        } catch (Exception failure) {
            return connectionError("telegram", failure);
        }
    }

    @PostMapping("/vk/connect")
    ResponseEntity<?> connectVk(@RequestBody(required = false) JsonNode input) {
        if (!runtime.status("telegram").connected()) {
            return error(409, "Сначала подключите Telegram.");
        }
        var token = string(input, "accessToken");
        var community = string(input, "community").strip();
        if (!length(token, 20, 500) || !length(community, 1, 300)) {
            return error(400, "Проверьте ссылку и ключ доступа.");
        }
        try {
            runtime.connectVk(token, community);
            return ResponseEntity.ok(Map.of("connected", true));
        } catch (Exception failure) {
            return connectionError("vk", failure);
        }
    }

    @DeleteMapping("/telegram")
    ResponseEntity<?> disconnectTelegram() {
        return disconnect("telegram", "Telegram");
    }

    @DeleteMapping("/vk")
    ResponseEntity<?> disconnectVk() {
        return disconnect("vk", "VK");
    }

    private ResponseEntity<?> disconnect(String channel, String name) {
        try {
            runtime.disconnect(channel);
            return ResponseEntity.ok(Map.of("connected", false));
        } catch (ChannelRuntime.SetupFailure failure) {
            return error(failure.status, failure.getMessage());
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
            return error(503, "Подключение каналов пока недоступно.");
        } catch (Exception failure) {
            return error(500, "Не удалось отключить " + name + ".");
        }
    }

    private static Map<String, Object> status(ChannelRuntime.SetupStatus current) {
        var result = new LinkedHashMap<String, Object>();
        result.put("connected", current.connected());
        result.put("locked", current.locked());
        result.put("source", current.source());
        if (current.expected()) {
            result.put("expected", true);
        }
        return result;
    }

    private static ResponseEntity<?> connectionError(String channel, Exception failure) {
        if (failure instanceof ChannelRuntime.SetupFailure setup) {
            return error(setup.status, setup.getMessage());
        }
        if (failure instanceof InterruptedException) {
            Thread.currentThread().interrupt();
            return error(503, "Подключение каналов пока недоступно.");
        }
        var detail = failure.getMessage() == null ? "" : failure.getMessage();
        var telegram = "telegram".equals(channel);
        if (detail.contains("requires confirmation of the existing identity")) {
            return error(400, "Владельцу установки нужно подтвердить прежнее подключение на сервере. История обращений сохранена.");
        }
        if (detail.contains("connection identity conflicts")) {
            return error(400, telegram
                    ? "История обращений относится к другому подключению. Используйте прежнего бота и прежнюю группу."
                    : "История обращений относится к другому подключению. Используйте прежнее сообщество VK.");
        }
        return error(400, telegram ? telegramMessage(detail) : vkMessage(detail));
    }

    private static String telegramMessage(String detail) {
        if (detail.contains("Topics enabled")) {
            return "Включите в выбранной группе темы и попробуйте снова.";
        }
        if (detail.contains("administrator")) {
            return "Назначьте бота администратором выбранной группы.";
        }
        if (detail.contains("can_manage_topics")) {
            return "Разрешите боту управлять темами группы.";
        }
        if (detail.contains("webhook")) {
            return "У бота уже настроена другая интеграция. Отключите её или создайте отдельного бота.";
        }
        return "Не удалось подключиться. Проверьте токен, группу и права бота.";
    }

    private static String vkMessage(String detail) {
        if (detail.contains("does not point to a community")) {
            return "Укажите ссылку именно на сообщество VK.";
        }
        if (detail.contains("missing manage permission")) {
            return "Создайте новый ключ VK и разрешите ему «Управление сообществом».";
        }
        if (detail.contains("missing messages permission")) {
            return "Создайте новый ключ VK и разрешите ему «Сообщения сообщества».";
        }
        if (detail.contains("Long Poll is disabled")) {
            return "Откройте «Дополнительно» → «Работа с API» → «Long Poll API» и включите Long Poll.";
        }
        if (detail.contains("message_new event is disabled")) {
            return "В Long Poll API откройте «Типы событий» и включите «Входящие сообщения».";
        }
        if (detail.contains("message_reply event is disabled")) {
            return "В Long Poll API откройте «Типы событий» и включите «Исходящие сообщения».";
        }
        if (detail.endsWith("with code 5")) {
            return "Ключ VK недействителен или был удалён. Создайте новый ключ доступа.";
        }
        if (detail.endsWith("with code 15")) {
            return "VK не дал ключу доступ к указанному сообществу. Проверьте, что ссылка и ключ относятся к одному сообществу.";
        }
        if (detail.endsWith("with code 27")) {
            return "Используйте ключ доступа, созданный в настройках самого сообщества VK.";
        }
        return "Не удалось подключить VK. Проверьте ссылку, ключ и права сообщества.";
    }

    private static String string(JsonNode input, String key) {
        return input != null && input.path(key).isString() ? input.path(key).asString() : "";
    }

    private static boolean length(String value, int minimum, int maximum) {
        return value.length() >= minimum && value.length() <= maximum;
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }
}
