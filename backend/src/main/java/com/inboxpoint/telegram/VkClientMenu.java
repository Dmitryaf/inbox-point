package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
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
        var active = store.activeRequest("vk", peer);
        var label = text.strip();
        var blocked = active == null && paused.test("vk");
        var answer = blocked && !information.isPublishedInformation(label)
                ? ClientInformation.INTAKE_PAUSED : response(label, active != null);
        if (answer == null) {
            return false;
        }
        if (!store.claim("vk:menu", event, Instant.now())) {
            return true;
        }
        try {
            api.send(peer, answer, "vk-menu:" + event, keyboard(blocked));
            if (information.isPublishedInformation(label)) {
                store.usageEvent("information:vk:" + event, "information_section", "vk", null, Instant.now());
            }
            store.completeEvent("vk:menu", event, Instant.now());
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
        if (ClientInformation.isHandoffRequest(label)) {
            return active ? "Напишите сообщение, и оператор получит его в текущем разговоре."
                    : "Напишите свой вопрос одним сообщением. Оператор ответит вам здесь.";
        }
        var command = label.toLowerCase(Locale.ROOT);
        if (List.of("/start", "/menu", "начать").contains(command)) {
            return active ? "У вас уже есть открытый вопрос. Напишите сообщение или выберите нужный раздел."
                    : "Здравствуйте! Выберите нужный раздел или напишите оператору.";
        }
        if (command.startsWith("/")) {
            return active ? "Просто напишите сообщение оператору или выберите нужный раздел."
                    : "Выберите нужный раздел.";
        }
        return null;
    }

    private JsonNode keyboard(boolean blocked) {
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
        if (!blocked) {
            rows.addArray().addObject().put("color", "primary").putObject("action").put("label", ASK).put("type", "text");
        }
        return layout;
    }
}
