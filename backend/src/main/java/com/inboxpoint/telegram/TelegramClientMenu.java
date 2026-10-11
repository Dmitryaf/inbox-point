package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Instant;
import java.util.function.Predicate;

import com.inboxpoint.content.ClientInformation;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.inboxpoint.content.ClientInformation.ASK;

final class TelegramClientMenu {
    private static final String SOURCE = "telegram:menu";

    private final TelegramStore store;
    private final TelegramBotApi api;
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
    }

    boolean handle(long chat, String event, String text, Instant now)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        return handle(chat, event, text, "", now);
    }

    boolean handle(long chat, String event, String text, String action, Instant now)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var stage = store.clientStage("telegram", chat, now);
        var pausedNow = paused.test("telegram");
        var classStage = switch (stage) {
            case FIRST_CONTACT -> com.inboxpoint.content.ClassMenu.Stage.FIRST_CONTACT;
            case ACTIVE -> com.inboxpoint.content.ClassMenu.Stage.ACTIVE;
            case AWAITING -> com.inboxpoint.content.ClassMenu.Stage.AWAITING_QUESTION;
            case CLOSED -> com.inboxpoint.content.ClassMenu.Stage.CLOSED;
        };
        var navigation = information.classAction(text.strip(), action,
                new com.inboxpoint.content.ClassMenu.State(classStage, pausedNow, store.awaitingQuestion("telegram", chat, now)));
        if (navigation != null) {
            return sendClassNavigation(chat, event, navigation, now);
        }
        var answer = ClientMenuPolicy.resolve(information, stage, text, pausedNow, action);
        if (answer == null) {
            return false;
        }
        if (!store.claim(SOURCE, event, now)) {
            return true;
        }
        try {
            if (answer.cancel()) {
                store.clearQuestion("telegram", chat);
                stage = store.clientStage("telegram", chat, now);
            } else if (answer.begin()) {
                store.beginQuestion("telegram", chat, now, answer.application());
            }
            var hidden = stage == ClientMenuPolicy.Stage.AWAITING || answer.begin();
            api.sendMessage(chat, null, answer.text(), hidden ? removeKeyboard() : keyboard(information, pausedNow));
            var selected = answer.information() || answer.application() != null ? information.action(text.strip())
                    : answer.begin() ? new ClientInformation.MenuAction("handoff", ClientInformation.ASK) : null;
            if (selected != null) {
                store.recordMenuAction("menu:telegram:" + event, "telegram", selected, now);
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

    private boolean sendClassNavigation(long chat, String event, com.inboxpoint.content.ClassMenu.Response response, Instant now)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (!store.claim(SOURCE, event, now)) {
            return true;
        }
        try {
            if (response.intent() != null) {
                store.beginQuestion("telegram", chat, now, response.intent().applicationLabel(), response.intent().questionContext());
            }
            var keyboard = JsonMapper.shared().createObjectNode();
            var rows = keyboard.putArray("inline_keyboard");
            for (var row : response.rows()) {
                var target = rows.addArray();
                for (var button : row) {
                    target.addObject().put("text", button.label()).put("callback_data", button.action());
                }
            }
            try {
                api.sendMessage(chat, null, response.text(), keyboard);
            } catch (TelegramBotApi.RequestFailed failure) {
                if (!failure.invalidKeyboard()) {
                    throw failure;
                }
                for (var text : com.inboxpoint.content.ClassMenu.inlineFallback(response)) {
                    api.sendMessage(chat, null, text);
                }
            }
            if (response.actionKey() != null) {
                store.recordMenuAction("menu:telegram:" + event, "telegram",
                        new ClientInformation.MenuAction(response.actionKey(), response.actionLabel()), now);
            }
            store.completeEvent(SOURCE, event, now);
        } catch (TelegramBotApi.RequestFailed failure) {
            if (failure.outcomeUnknown()) {
                store.completeEvent(SOURCE, event, now);
            } else {
                store.release(SOURCE, event);
            }
            throw failure;
        }
        return true;
    }

    static JsonNode removeKeyboard() {
        return JsonMapper.shared().createObjectNode().put("remove_keyboard", true);
    }

    static JsonNode keyboard(ClientInformation information, boolean blocked) {
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
        var custom = information.sections();
        for (int index = 0; index < custom.size(); index += 2) {
            var row = rows.addArray();
            for (var section : custom.subList(index, Math.min(index + 2, custom.size()))) {
                row.addObject().put("text", section.label());
            }
        }
        if (!blocked) {
            rows.addArray().addObject().put("text", ASK);
        }
        return rows.isEmpty() ? removeKeyboard() : markup;
    }
}
