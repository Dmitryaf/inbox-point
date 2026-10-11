package com.inboxpoint.content;

import java.util.List;

public final class ClassMenu {
    private ClassMenu() { }

    public enum Stage { FIRST_CONTACT, ACTIVE, AWAITING_QUESTION, CLOSED }

    public enum Keyboard { REPLY, INLINE, REMOVE }

    public record State(Stage stage, boolean intakePaused, boolean awaitingQuestion) {
    }

    public record Intent(String applicationLabel, String questionContext, boolean classEnrollment) {
    }

    public record Button(String label, String action, String command) {
    }

    public record Response(String text, Keyboard keyboard, List<List<Button>> rows,
            Intent intent, boolean cancelIntent, String actionKey, String actionLabel) {
    }

    public static List<String> inlineFallback(Response response) {
        var commands = response.rows().stream().flatMap(List::stream)
                .map(button -> "• " + button.label() + ": «" + button.command() + "»").toList();
        var controls = "Кнопки недоступны. Напишите нужную команду:\n" + String.join("\n", commands);
        return response.text().length() + controls.length() + 2 <= 4000
                ? List.of(response.text() + "\n\n" + controls) : List.of(response.text(), controls);
    }

}
