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

import static com.inboxpoint.content.ClientInformation.ADDRESS;
import static com.inboxpoint.content.ClientInformation.ASK;
import static com.inboxpoint.content.ClientInformation.FAQ;
import static com.inboxpoint.content.ClientInformation.PRICES;
import static com.inboxpoint.content.ClientInformation.SCHEDULE;

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
            api.send(peer, answer, "vk-menu:" + event, keyboard(information.sections()));
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

    private static JsonNode keyboard(List<ClientInformation.Section> sections) {
        var layout = JsonMapper.shared().createObjectNode().put("inline", false).put("one_time", false);
        var rows = layout.putArray("buttons");
        for (var labels : List.of(List.of(SCHEDULE, PRICES), List.of(ADDRESS, FAQ), List.of(ASK))) {
            var row = rows.addArray();
            for (var label : labels) {
                row.addObject().put("color", ASK.equals(label) ? "primary" : "secondary").putObject("action")
                        .put("label", label).put("type", "text");
            }
        }
        for (var section : sections) {
            rows.addArray().addObject().put("color", "secondary").putObject("action")
                    .put("label", section.label()).put("type", "text");
        }
        return layout;
    }
}
