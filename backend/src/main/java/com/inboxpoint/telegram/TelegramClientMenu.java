package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class TelegramClientMenu {
    private static final String SCHEDULE = "Расписание";
    private static final String PRICES = "Цены";
    private static final String ADDRESS = "Адрес";
    private static final String ASK = "Задать вопрос преподавателю";
    private static final String RESET = "Начать новый вопрос";
    private static final String SOURCE = "telegram:menu";
    private static final JsonNode KEYBOARD = keyboard();

    private final TelegramStore store;
    private final TelegramBotApi api;
    private final long group;

    TelegramClientMenu(TelegramStore store, TelegramBotApi api, long group) {
        this.store = store;
        this.api = api;
        this.group = group;
    }

    boolean handle(long chat, String event, String text, Instant now)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var active = store.activeRequest(chat);
        var trimmed = text.strip();
        var response = response(trimmed, active != null);
        if (response == null) {
            return false;
        }
        if (!store.claim(SOURCE, event, now)) {
            return true;
        }
        try {
            if (RESET.equals(trimmed) && active != null) {
                api.closeTopic(group, active.topic());
                store.changeStatus(active.id(), false, now);
            }
            api.sendMessage(chat, null, response, KEYBOARD);
        } catch (TelegramBotApi.RequestFailed failure) {
            if (!failure.outcomeUnknown()) {
                store.release(SOURCE, event);
            }
            throw failure;
        }
        return true;
    }

    private static String response(String text, boolean active) {
        var unavailable = switch (text) {
            case SCHEDULE -> "Расписание пока не добавлено.";
            case PRICES -> "Цены пока не добавлены.";
            case ADDRESS -> "Адрес пока не добавлен.";
            default -> null;
        };
        if (unavailable != null) {
            return unavailable + " Вы можете задать вопрос преподавателю.";
        }
        if (RESET.equals(text)) {
            return active ? "Предыдущий разговор завершён. Выберите нужный раздел." : "Выберите нужный раздел.";
        }
        if (ASK.equals(text)) {
            return active ? "Напишите сообщение, и преподаватель получит его в текущем разговоре."
                    : "Напишите свой вопрос одним сообщением. Преподаватель ответит вам в этом чате.";
        }
        var command = text.split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        if ("/start".equals(command) || "/menu".equals(command)) {
            return active
                    ? "У вас уже есть открытый вопрос. Напишите сообщение, чтобы продолжить разговор, или выберите нужный раздел."
                    : "Здравствуйте! Я помогу быстро найти основную информацию.\n\n"
                            + "Выберите нужный раздел или задайте вопрос преподавателю.";
        }
        if (command.startsWith("/")) {
            return active ? "Эта команда недоступна во время разговора. Просто напишите сообщение преподавателю."
                    : "Открытого обращения нет. Выберите нужный раздел в меню.";
        }
        return null;
    }

    private static JsonNode keyboard() {
        var markup = JsonMapper.shared().createObjectNode().put("resize_keyboard", true)
                .put("is_persistent", true).put("input_field_placeholder", "Выберите действие");
        var rows = markup.putArray("keyboard");
        for (var buttons : List.of(List.of(SCHEDULE, PRICES), List.of(ADDRESS), List.of(ASK), List.of(RESET))) {
            var row = rows.addArray();
            for (var button : buttons) {
                row.addObject().put("text", button);
            }
        }
        return markup;
    }
}
