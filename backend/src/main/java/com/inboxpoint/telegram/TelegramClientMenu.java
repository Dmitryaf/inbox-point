package com.inboxpoint.telegram;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;

import com.inboxpoint.content.ClientCatalog;
import com.inboxpoint.content.ClientMenu;
import com.inboxpoint.content.ClientMenu.Button;
import com.inboxpoint.content.ClientMenu.Keyboard;
import com.inboxpoint.content.ClientMenu.Response;
import com.inboxpoint.handoff.ClientMessages;
import com.inboxpoint.operations.LocalServiceControl;
import com.inboxpoint.persistence.SqliteTextHandoff;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class TelegramClientMenu {
    private static final String CHANNEL = "telegram";
    private static final JsonMapper JSON = JsonMapper.shared();

    private final SqliteTextHandoff store;
    private final TelegramBotApi api;
    private final Path settings;
    private final LocalServiceControl control;

    TelegramClientMenu(Path database, SqliteTextHandoff store, TelegramBotApi api) {
        settings = database.resolveSibling("content-settings.json");
        control = new LocalServiceControl(database);
        this.store = store;
        this.api = api;
    }

    boolean handle(long chat, String eventId, String text, String action, Instant now)
            throws SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        if (store.hasHandledMenuResponse(CHANNEL, eventId)) {
            return true;
        }
        var menu = catalog();
        var conversation = Long.toString(chat);
        var state = store.menuState(CHANNEL, conversation, control.intakePaused(CHANNEL), now);
        var response = menu.resolve(text, action, state);
        if (response.isEmpty()) {
            return false;
        }
        var selected = response.get();
        if (store.prepareMenuResponse(CHANNEL, conversation, eventId, selected, now)) {
            send(chat, selected);
            store.completeMenuResponse(CHANNEL, eventId, now);
        }
        return true;
    }

    void unsupported(long chat, String eventId, Instant now)
            throws SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        if (!store.hasHandledMenuResponse(CHANNEL, eventId)) {
            api.sendMessage(chat, null, ClientMessages.UNSUPPORTED_CONTENT, mainMarkup(chat, now));
            store.completeMenuResponse(CHANNEL, eventId, now);
        }
    }

    JsonNode mainMarkup(long chat, Instant now) throws SQLException {
        var conversation = Long.toString(chat);
        var state = store.menuState(CHANNEL, conversation, control.intakePaused(CHANNEL), now);
        var rows = catalog().mainRows(state);
        return markup(rows.isEmpty() ? Keyboard.REMOVE : Keyboard.REPLY, rows);
    }

    boolean deliveryPaused() throws SQLException {
        return control.deliveryPaused();
    }

    static JsonNode enrollmentMarkup(String enrollmentId, boolean sent) {
        var label = sent ? "Подтверждение отправлено" : "Подтвердить запись";
        return markup(Keyboard.INLINE, List.of(List.of(new Button(label, "enroll:" + enrollmentId, ""))));
    }

    private void send(long chat, Response response) throws TelegramBotApi.RequestFailed, InterruptedException {
        try {
            api.sendMessage(chat, null, response.text(), markup(response.keyboard(), response.rows()));
        } catch (TelegramBotApi.RequestFailed failure) {
            if (!failure.invalidKeyboard()) {
                throw failure;
            }
            if (response.keyboard() != Keyboard.INLINE) {
                api.sendMessage(chat, null, response.text());
                return;
            }
            for (var text : ClientMenu.inlineFallback(response)) {
                api.sendMessage(chat, null, text);
            }
        }
    }

    private ClientMenu catalog() throws SQLException {
        try {
            return new ClientMenu(ClientCatalog.load(settings));
        } catch (IOException | IllegalArgumentException failure) {
            throw new SQLException("Could not load local client content settings");
        }
    }

    private static JsonNode markup(Keyboard keyboard, List<List<Button>> rows) {
        var markup = JSON.createObjectNode();
        if (keyboard == Keyboard.REMOVE) {
            return markup.put("remove_keyboard", true);
        }
        var inline = keyboard == Keyboard.INLINE;
        var grid = markup.putArray(inline ? "inline_keyboard" : "keyboard");
        for (var row : rows) {
            var buttons = grid.addArray();
            for (var item : row) {
                var button = buttons.addObject().put("text", item.label());
                if (inline) {
                    button.put("callback_data", item.action());
                }
            }
        }
        if (!inline) {
            markup.put("input_field_placeholder", "Выберите действие").put("is_persistent", true)
                    .put("resize_keyboard", true);
        }
        return markup;
    }
}
