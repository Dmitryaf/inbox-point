package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Instant;
import java.util.Locale;
import java.util.function.Predicate;

import com.inboxpoint.content.ClientInformation;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.inboxpoint.content.ClientInformation.ASK;
import static com.inboxpoint.content.ClientInformation.RESET;

final class TelegramClientMenu {
    private static final String SOURCE = "telegram:menu";

    private final TelegramStore store;
    private final TelegramBotApi api;
    private final OperatorInbox inbox;
    private final ClientInformation information;
    private final Predicate<String> paused;

    TelegramClientMenu(TelegramStore store, TelegramBotApi api, long group, ClientInformation information, Predicate<String> paused) {
        this(store, api, new TelegramTopicsInbox(api, group), information, paused);
    }

    TelegramClientMenu(TelegramStore store, TelegramBotApi api, OperatorInbox inbox, ClientInformation information, Predicate<String> paused) {
        this.paused = paused;
        this.information = information;
        this.store = store;
        this.api = api;
        this.inbox = inbox;
    }

    boolean handle(long chat, String event, String text, Instant now)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var active = store.activeRequest(chat);
        var trimmed = text.strip();
        var blocked = active == null && paused.test("telegram");
        var published = information.isPublishedInformation(trimmed);
        var response = blocked && !published ? ClientInformation.INTAKE_PAUSED : response(trimmed, active != null);
        if (response == null) {
            return false;
        }
        if (!store.claim(SOURCE, event, now)) {
            return true;
        }
        try {
            if (RESET.equals(trimmed) && active != null) {
                inbox.close(active.topic());
                store.changeStatus(active.id(), false, now);
            }
            api.sendMessage(chat, null, response, keyboard(blocked));
            if (information.isPublishedInformation(trimmed)) {
                store.pilotEvent("information:telegram:" + event, "information_section", "telegram", null, Instant.now());
            }
            store.completeEvent(SOURCE, event, now);
        } catch (TelegramBotApi.RequestFailed failure) {
            if (!failure.outcomeUnknown()) {
                store.release(SOURCE, event);
            } else {
                store.completeEvent(SOURCE, event, now);
            }
            throw failure;
        }
        return true;
    }

    private String response(String text, boolean active) {
        var answer = information.resolve(text);
        if (answer != null) {
            return answer;
        }
        if (RESET.equals(text)) {
            return active ? "Предыдущий разговор завершён. Выберите нужный раздел." : "Выберите нужный раздел.";
        }
        if (ClientInformation.isHandoffRequest(text)) {
            return active ? "Напишите сообщение, и оператор получит его в текущем разговоре."
                    : "Напишите свой вопрос одним сообщением. Оператор ответит вам в этом чате.";
        }
        var command = text.split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        if ("/start".equals(command) || "/menu".equals(command)) {
            return active
                    ? "У вас уже есть открытый вопрос. Напишите сообщение, чтобы продолжить разговор, или выберите нужный раздел."
                    : "Здравствуйте! Я помогу быстро найти основную информацию.\n\n"
                            + "Выберите нужный раздел или напишите оператору.";
        }
        if (command.startsWith("/")) {
            return active ? "Эта команда недоступна во время разговора. Просто напишите сообщение оператору."
                    : "Открытого обращения нет. Выберите нужный раздел в меню.";
        }
        return null;
    }

    private JsonNode keyboard(boolean blocked) {
        var markup = JsonMapper.shared().createObjectNode().put("resize_keyboard", true)
                .put("is_persistent", true).put("input_field_placeholder", "Выберите действие");
        var rows = markup.putArray("keyboard");
        var standard = information.informationButtons();
        for (int index = 0; index < standard.size(); index += 2) {
            var row = rows.addArray();
            for (var label : standard.subList(index, Math.min(index + 2, standard.size()))) {
                row.addObject().put("text", label);
            }
        }
        for (var section : information.sections()) {
            rows.addArray().addObject().put("text", section.label());
        }
        if (!blocked) {
            rows.addArray().addObject().put("text", ASK);
            rows.addArray().addObject().put("text", RESET);
        }
        return markup;
    }
}
