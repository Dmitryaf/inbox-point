package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Instant;
import java.util.function.Predicate;

import com.inboxpoint.content.ClientInformation;
import com.inboxpoint.vk.VkChannel;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.inboxpoint.content.ClientInformation.ASK;

final class VkClientMenu {

    private final ClientInformation information;
    private final Predicate<String> paused;
    private final VkChannel api;

    VkClientMenu(ClientInformation information, VkChannel api, Predicate<String> paused) {
        this.paused = paused;
        this.information = information;
        this.api = api;
    }

    boolean handle(TelegramStore store, String event, long peer, String text)
            throws IOException, SQLException, InterruptedException {
        return handle(store, event, peer, text, "");
    }

    boolean handle(TelegramStore store, String event, long peer, String text, String payload)
            throws IOException, SQLException, InterruptedException {
        var now = Instant.now();
        var stage = store.clientStage("vk", peer, now);
        var pausedNow = paused.test("vk");
        var classStage = switch (stage) {
            case FIRST_CONTACT -> com.inboxpoint.content.ClassMenu.Stage.FIRST_CONTACT;
            case ACTIVE -> com.inboxpoint.content.ClassMenu.Stage.ACTIVE;
            case AWAITING -> com.inboxpoint.content.ClassMenu.Stage.AWAITING_QUESTION;
            case CLOSED -> com.inboxpoint.content.ClassMenu.Stage.CLOSED;
        };
        var command = action(payload);
        if ("main".equals(command)) {
            text = "Меню";
        }
        var navigation = information.classAction(text.strip(), command,
                new com.inboxpoint.content.ClassMenu.State(classStage, pausedNow, store.awaitingQuestion("vk", peer, now)));
        if (navigation != null) {
            return sendClassNavigation(store, event, peer, navigation, now);
        }
        var answer = ClientMenuPolicy.resolve(information, stage, text, pausedNow, command);
        if (answer == null) {
            return false;
        }
        if (!store.claim("vk:menu", event, now)) {
            return true;
        }
        try {
            if (answer.cancel()) {
                store.clearQuestion("vk", peer);
                stage = store.clientStage("vk", peer, now);
            } else if (answer.begin()) {
                store.beginQuestion("vk", peer, now, answer.application());
            }
            var hidden = stage == ClientMenuPolicy.Stage.AWAITING || answer.begin();
            api.send(peer, answer.text(), "vk-menu:" + event, hidden ? hiddenKeyboard() : keyboard(pausedNow));
            var selected = answer.information() || answer.application() != null ? information.action(text.strip())
                    : answer.begin() ? new ClientInformation.MenuAction("handoff", ClientInformation.ASK) : null;
            if (selected != null) {
                store.recordMenuAction("menu:vk:" + event, "vk", selected, now);
            }
            store.completeEvent("vk:menu", event, now);
            return true;
        } catch (IOException failure) {
            store.release("vk:menu", event);
            throw failure;
        }
    }

    private boolean sendClassNavigation(TelegramStore store, String event, long peer,
            com.inboxpoint.content.ClassMenu.Response response, Instant now) throws IOException, SQLException, InterruptedException {
        var source = "vk:menu";
        if (!store.claim(source, event, now)) {
            return true;
        }
        try {
            if (response.intent() != null) {
                store.beginQuestion("vk", peer, now, response.intent().applicationLabel(), response.intent().questionContext(), response.intent().classEnrollment());
            }
            var keyboard = JsonMapper.shared().createObjectNode().put("inline", true);
            var rows = keyboard.putArray("buttons");
            for (var row : response.rows()) {
                var target = rows.addArray();
                for (var button : row) {
                    target.addObject().put("color", "secondary").putObject("action").put("type", "text")
                            .put("label", button.label()).put("payload", JsonMapper.shared().createObjectNode().put("action", button.action()).toString());
                }
            }
            api.send(peer, response.text(), "vk-menu:" + event, keyboard);
            if (response.actionKey() != null) {
                store.recordMenuAction("menu:vk:" + event, "vk",
                        new ClientInformation.MenuAction(response.actionKey(), response.actionLabel()), now);
            }
            store.completeEvent(source, event, now);
            return true;
        } catch (IOException failure) {
            store.release(source, event);
            throw failure;
        }
    }

    private static String action(String payload) {
        if (payload == null || payload.isBlank()) {
            return "";
        }
        try {
            return JsonMapper.shared().readTree(payload).path("action").asString("");
        } catch (tools.jackson.core.JacksonException malformed) {
            return "";
        }
    }

    static JsonNode hiddenKeyboard() {
        var keyboard = JsonMapper.shared().createObjectNode().put("inline", false).put("one_time", false);
        keyboard.putArray("buttons");
        return keyboard;
    }

    private JsonNode keyboard(boolean blocked) {
        var layout = JsonMapper.shared().createObjectNode().put("inline", false).put("one_time", false);
        var rows = layout.putArray("buttons");
        var standard = information.informationButtons();
        for (int index = 0; index < standard.size(); index += 2) {
            var row = rows.addArray();
            for (int button = index; button < Math.min(index + 2, standard.size()); button++) {
                row.addObject().put("color", "secondary").putObject("action").put("label", standard.get(button)).put("type", "text")
                        .put("payload", "{\"action\":\"information-" + button + "\"}");
            }
        }
        int custom = 0;
        for (var section : information.sections()) {
            rows.addArray().addObject().put("color", "secondary").putObject("action")
                    .put("label", section.label()).put("type", "text")
                    .put("payload", "{\"action\":\"custom-" + custom++ + "\"}");
        }
        if (!blocked) {
            rows.addArray().addObject().put("color", "primary").putObject("action").put("label", ASK).put("type", "text")
                    .put("payload", "{\"action\":\"handoff\"}");
        }
        return layout;
    }
}
