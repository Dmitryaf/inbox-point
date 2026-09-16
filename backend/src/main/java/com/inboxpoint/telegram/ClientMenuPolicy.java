package com.inboxpoint.telegram;

import java.util.Locale;

import com.inboxpoint.content.ClientInformation;

final class ClientMenuPolicy {
    enum Stage { FIRST_CONTACT, AWAITING, ACTIVE, CLOSED }

    record Response(String text, boolean begin, boolean information) {
        Response(String text) { this(text, false, false); }
    }

    private ClientMenuPolicy() { }

    static Response resolve(ClientInformation information, Stage stage, String input, boolean paused, String action) {
        var text = input.strip();
        var command = text.split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        var menu = "/start".equals(command) || "/menu".equals(command) || "начать".equals(command);
        var informationAction = action.startsWith("information-") || action.startsWith("custom-");
        if (stage == Stage.ACTIVE) {
            if (informationAction) {
                return resolveInformation(information, text);
            }
            if (menu || "handoff".equals(action)) {
                return new Response("Разговор уже начат. Напишите сообщение, чтобы продолжить.");
            }
            return command.startsWith("/")
                    ? new Response("Эта команда недоступна во время разговора. Просто напишите сообщение.") : null;
        }
        if (paused || informationAction) {
            var response = resolveInformation(information, text);
            if (response != null) {
                return response;
            }
            if (paused) {
                return new Response(ClientInformation.INTAKE_PAUSED);
            }
        }
        if (stage == Stage.AWAITING && !command.startsWith("/")) {
            return null;
        }
        var response = resolveInformation(information, text);
        if (response != null) {
            return response;
        }
        if ("handoff".equals(action) || ClientInformation.isHandoffRequest(text) || ClientInformation.RESET.equals(text)) {
            return new Response("Напишите свой вопрос. Мы ответим здесь.", true, false);
        }
        if (menu) {
            return new Response("Здравствуйте! Здесь можно посмотреть основную информацию или задать вопрос.");
        }
        if (command.startsWith("/")) {
            return new Response("Открытого обращения нет. Выберите нужный раздел в меню.");
        }
        return stage == Stage.CLOSED
                ? new Response("Предыдущий разговор завершён. Если хотите задать новый вопрос, нажмите «Задать вопрос».") : null;
    }

    private static Response resolveInformation(ClientInformation information, String text) {
        if (information.isStaleMenuAction(text)) {
            return new Response("Меню обновилось. Выберите нужный раздел ниже.");
        }
        if (information.isPublishedInformation(text)) {
            return new Response(information.resolve(text), false, true);
        }
        return null;
    }
}
