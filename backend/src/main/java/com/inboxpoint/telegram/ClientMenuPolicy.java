package com.inboxpoint.telegram;

import java.util.Locale;

import com.inboxpoint.content.ClientInformation;

final class ClientMenuPolicy {
    enum Stage { FIRST_CONTACT, AWAITING, ACTIVE, CLOSED }

    record Response(String text, boolean begin, boolean information, boolean cancel) {
        Response(String text) { this(text, false, false, false); }
        Response(String text, boolean begin, boolean information) { this(text, begin, information, false); }
    }

    private ClientMenuPolicy() { }

    static Response resolve(ClientInformation information, Stage stage, String input, boolean paused, String action) {
        var text = input.strip();
        var command = text.split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        var menu = "/start".equals(command) || "/menu".equals(command) || "начать".equals(command);
        var informationAction = action.startsWith("information-") || action.startsWith("custom-");
        if (stage == Stage.ACTIVE) {
            var answer = resolveInformation(information, text);
            if (answer != null) {
                return answer;
            }
            if (informationAction) {
                return new Response(ClientMessages.MENU_UPDATED);
            }
            if ("handoff".equals(action) || ClientInformation.isHandoffRequest(text) || ClientInformation.RESET.equals(text)) {
                return new Response(ClientMessages.QUESTION_PROMPT);
            }
            if (menu) {
                return new Response(ClientMessages.ACTIVE_MENU);
            }
            return command.startsWith("/")
                    ? new Response(ClientMessages.ACTIVE_COMMAND_UNAVAILABLE) : null;
        }
        if (stage == Stage.AWAITING && menu) {
            var greeting = paused ? ClientMessages.PAUSED_INTAKE
                    : stage == Stage.FIRST_CONTACT ? ClientMessages.GREETING : ClientMessages.MENU_OPENED;
            return new Response(greeting, false, false, true);
        }
        if (paused || informationAction) {
            var response = resolveInformation(information, text);
            if (response != null) {
                return response;
            }
            if (paused) {
                return new Response(ClientMessages.PAUSED_INTAKE);
            }
        }
        if (stage == Stage.AWAITING && !command.startsWith("/") && !"handoff".equals(action)
                && !ClientInformation.isHandoffRequest(text) && !ClientInformation.RESET.equals(text)) {
            return null;
        }
        var response = resolveInformation(information, text);
        if (response != null) {
            return response;
        }
        if ("handoff".equals(action) || ClientInformation.isHandoffRequest(text) || ClientInformation.RESET.equals(text)) {
            return new Response(ClientMessages.QUESTION_PROMPT, true, false);
        }
        if (menu) {
            return new Response(stage == Stage.FIRST_CONTACT ? ClientMessages.GREETING : ClientMessages.MENU_OPENED);
        }
        if (command.startsWith("/")) {
            return new Response(ClientMessages.NO_OPEN_REQUEST);
        }
        return stage == Stage.CLOSED
                ? new Response(ClientMessages.CLOSED_CONVERSATION) : null;
    }

    private static Response resolveInformation(ClientInformation information, String text) {
        if (information.isStaleMenuAction(text)) {
            return new Response(ClientMessages.MENU_UPDATED);
        }
        if (information.isPublishedInformation(text)) {
            return new Response(information.resolve(text), false, true);
        }
        return null;
    }
}
