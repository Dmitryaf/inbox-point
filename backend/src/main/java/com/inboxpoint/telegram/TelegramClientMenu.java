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
        var stage = store.clientStage("telegram", chat);
        var pausedNow = paused.test("telegram");
        var answer = ClientMenuPolicy.resolve(information, stage, text, pausedNow, "");
        if (answer == null) {
            return false;
        }
        if (!store.claim(SOURCE, event, now)) {
            return true;
        }
        try {
            var hidden = stage == ClientMenuPolicy.Stage.ACTIVE || stage == ClientMenuPolicy.Stage.AWAITING || answer.begin();
            api.sendMessage(chat, null, answer.text(), hidden ? removeKeyboard() : keyboard(information, pausedNow));
            if (answer.begin()) {
                store.beginQuestion("telegram", chat, now);
            }
            if (answer.information()) {
                store.usageEvent("information:telegram:" + event, "information_section", "telegram", null, now);
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
