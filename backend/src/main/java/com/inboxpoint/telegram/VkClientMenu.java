package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

import com.inboxpoint.content.ClientInformation;
import com.inboxpoint.vk.VkChannel;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static com.inboxpoint.content.ClientInformation.ASK;

final class VkClientMenu {

    private final ClientInformation information;
    private final VkChannel api;

    VkClientMenu(ClientInformation information, VkChannel api) {
        this.information = information;
        this.api = api;
    }

    boolean handle(TelegramStore store, String event, long peer, String text)
            throws IOException, SQLException, InterruptedException {
        var active = store.activeRequest("vk", peer);
        var label = text.strip();
        var answer = response(label, active != null);
        if (answer == null) {
            return false;
        }
        if (!store.claim("vk:menu", event, Instant.now())) {
            return true;
        }
        try {
            api.send(peer, answer, "vk-menu:" + event, keyboard());
            return true;
        } catch (IOException failure) {
            store.release("vk:menu", event);
            throw failure;
        }
    }

    private String response(String label, boolean active) {
        var informationAnswer = information.resolve(label);
        if (informationAnswer != null) {
            return informationAnswer;
        }
        if (ASK.equals(label)) {
            return active ? "Напишите сообщение, и преподаватель получит его в текущем разговоре."
                    : "Напишите свой вопрос одним сообщением. Преподаватель ответит вам здесь.";
        }
        var command = label.toLowerCase(Locale.ROOT);
        if (List.of("/start", "/menu", "начать").contains(command)) {
            return active ? "У вас уже есть открытый вопрос. Напишите сообщение или выберите нужный раздел."
                    : "Здравствуйте! Выберите нужный раздел или задайте вопрос преподавателю.";
        }
        if (command.startsWith("/")) {
            return active ? "Просто напишите сообщение преподавателю или выберите нужный раздел."
                    : "Выберите нужный раздел.";
        }
        return null;
    }

    private JsonNode keyboard() {
        var layout = JsonMapper.shared().createObjectNode().put("inline", false).put("one_time", false);
        var rows = layout.putArray("buttons");
        var standard = information.informationButtons();
        for (int index = 0; index < standard.size(); index += 2) {
            var row = rows.addArray();
            for (var label : standard.subList(index, Math.min(index + 2, standard.size()))) {
                row.addObject().put("color", "secondary").putObject("action").put("label", label).put("type", "text");
            }
        }
        for (var section : information.sections()) {
            rows.addArray().addObject().put("color", "secondary").putObject("action")
                    .put("label", section.label()).put("type", "text");
        }
        rows.addArray().addObject().put("color", "primary").putObject("action").put("label", ASK).put("type", "text");
        return layout;
    }
}
