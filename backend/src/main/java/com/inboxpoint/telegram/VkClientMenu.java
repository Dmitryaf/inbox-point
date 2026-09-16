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
        var stage = store.clientStage("vk", peer);
        var pausedNow = paused.test("vk");
        var answer = ClientMenuPolicy.resolve(information, stage, text, pausedNow, action(payload));
        if (answer == null) {
            return false;
        }
        var now = Instant.now();
        if (!store.claim("vk:menu", event, now)) {
            return true;
        }
        try {
            if (answer.cancel()) {
                store.clearQuestion("vk", peer);
                stage = store.clientStage("vk", peer);
            } else if (answer.begin()) {
                store.beginQuestion("vk", peer, now);
            }
            var hidden = stage == ClientMenuPolicy.Stage.AWAITING || answer.begin();
            api.send(peer, answer.text(), "vk-menu:" + event, hidden ? hiddenKeyboard() : keyboard(pausedNow));
            if (answer.information()) {
                store.usageEvent("information:vk:" + event, "information_section", "vk", null, now);
            }
            store.completeEvent("vk:menu", event, now);
            return true;
        } catch (IOException failure) {
            store.release("vk:menu", event);
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
