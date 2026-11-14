package com.inboxpoint.content;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import com.inboxpoint.handoff.ClientMessages;

public final class ClientMenu {
    public enum Stage { FIRST_CONTACT, ACTIVE, AWAITING_QUESTION, CLOSED }

    public enum Keyboard { REPLY, INLINE, REMOVE }

    public record State(Stage stage, boolean intakePaused, boolean awaitingQuestion) {
    }

    public record Intent(String applicationLabel, String questionContext, String enrollmentConfirmation) {
    }

    public record Button(String label, String action, String command) {
    }

    public record Response(String text, Keyboard keyboard, List<List<Button>> rows,
            Intent intent, boolean cancelIntent, String actionKey, String actionLabel) {
    }

    private static final String ASK = "Задать вопрос";
    private static final String NEW_QUESTION = "Начать новый вопрос";
    private static final Intent QUESTION = new Intent(null, null, null);

    private final ClientCatalog catalog;
    private final ClassNavigation classes;

    public ClientMenu(ClientCatalog catalog) {
        this.catalog = catalog;
        this.classes = new ClassNavigation(catalog);
    }

    public Optional<Response> resolve(String text, String action, State state) {
        return resolve(text, action, state, false);
    }

    public Optional<Response> resolveVk(String text, String action, State state) {
        var label = text.strip();
        var commandText = "начать".equalsIgnoreCase(label) ? "/start" : label;
        return resolve(commandText, action, state, true);
    }

    private Optional<Response> resolve(String text, String action, State state, boolean structuredInformationOnly) {
        var label = text.strip();
        if (action != null && action.startsWith("classes:")) {
            return Optional.of(classes.render(action, state));
        }
        var information = action != null && (action.startsWith("custom:") || action.startsWith("custom-")
                || action.startsWith("information-") || ClientCatalog.SECTIONS.stream()
                        .anyMatch(section -> section.id().equals(action)));
        if (action != null) {
            var resolved = labelForAction(action);
            if (resolved.isEmpty() && (!structuredInformationOnly || action.startsWith("custom:"))) {
                return Optional.of(reply(ClientMessages.MENU_UPDATED, state, null, false, null, null));
            }
            label = resolved.orElse(label);
        }
        var command = command(label);
        var navigation = classes.resolve(label, action != null, state,
                !structuredInformationOnly || "schedule".equals(action) || state.stage() != Stage.ACTIVE);
        if (navigation.isPresent()) {
            return navigation;
        }
        return resolveMain(label, command, state, !structuredInformationOnly || information,
                structuredInformationOnly && information);
    }

    public static List<String> inlineFallback(Response response) {
        var commands = response.rows().stream().flatMap(List::stream)
                .map(button -> "• " + button.label() + ": «" + button.command() + "»").toList();
        var controls = "Кнопки недоступны. Напишите нужную команду:\n" + String.join("\n", commands);
        return response.text().length() + controls.length() + 2 <= 4000
                ? List.of(response.text() + "\n\n" + controls) : List.of(response.text(), controls);
    }

    public List<List<Button>> mainRows(State state) {
        if (state.stage() == Stage.AWAITING_QUESTION) {
            return List.of();
        }
        var sections = catalog.informationButtons().stream()
                .map(section -> new Button(section.label(), section.id(), section.label())).toList();
        var custom = catalog.custom().stream()
                .filter(item -> !state.intakePaused() || state.stage() == Stage.ACTIVE || !item.application())
                .map(item -> new Button(item.label(), "custom:" + item.id(), item.label())).toList();
        var result = new ArrayList<List<Button>>();
        pairs(result, sections);
        pairs(result, custom);
        if (!state.intakePaused()) {
            result.add(List.of(new Button(ASK, "handoff", ASK)));
        }
        return List.copyOf(result);
    }

    private Optional<Response> resolveMain(String label, String command, State state, boolean showInformation,
            boolean explicitInformation) {
        var active = state.stage() == Stage.ACTIVE;
        var awaiting = state.stage() == Stage.AWAITING_QUESTION;
        var start = "/start".equals(command);
        var main = "/menu".equals(command);
        var ask = ASK.equals(label) || NEW_QUESTION.equals(label);
        var key = actionForLabel(label);
        var application = catalog.custom().stream()
                .filter(item -> item.application() && item.label().equals(label)).findFirst();
        if (showInformation && application.isPresent()) {
            var item = application.get();
            return Optional.of(state.intakePaused() && !active
                    ? reply(ClientMessages.PAUSED_INTAKE, state, null, false, null, null)
                    : prompt(item.text(), state, new Intent(item.label(), null, null), key, label));
        }
        if (awaiting && (start || main)) {
            var next = new State(Stage.FIRST_CONTACT, state.intakePaused(), false);
            return Optional.of(reply(state.intakePaused() ? ClientMessages.PAUSED_INTAKE
                    : start ? ClientMessages.GREETING : ClientMessages.MENU_OPENED, next, null, true, null, null));
        }
        if (awaiting && !state.intakePaused()) {
            if (ask) {
                return Optional.of(prompt(ClientMessages.QUESTION_PROMPT, state, QUESTION, key, label));
            }
            if (!explicitInformation && !command.startsWith("/")) {
                return Optional.empty();
            }
        }
        var information = showInformation ? catalog.sectionText(label) : Optional.<String>empty();
        if (information.isPresent()) {
            return Optional.of(reply(information.get(), state, null, false, key, label));
        }
        if (showInformation && catalog.stale(label)) {
            return Optional.of(reply(ClientMessages.MENU_UPDATED, state, null, false, null, null));
        }
        if (active) {
            if (ask) {
                return Optional.of(reply(ClientMessages.QUESTION_PROMPT, state, null, false, key, label));
            }
            if (main || start) {
                return Optional.of(reply(ClientMessages.ACTIVE_MENU, state, null, true, null, null));
            }
            return command.startsWith("/")
                    ? Optional.of(reply(ClientMessages.ACTIVE_COMMAND_UNAVAILABLE, state, null, false, null, null))
                    : Optional.empty();
        }
        if (state.intakePaused()) {
            return Optional.of(reply(ClientMessages.PAUSED_INTAKE, state, null, false, null, null));
        }
        if (ask) {
            return Optional.of(prompt(ClientMessages.QUESTION_PROMPT, state, QUESTION, key, label));
        }
        if (main || start) {
            return Optional.of(reply(start ? ClientMessages.GREETING : ClientMessages.MENU_OPENED,
                    state, null, false, null, null));
        }
        if (command.startsWith("/")) {
            return Optional.of(reply(ClientMessages.NO_OPEN_REQUEST, state, null, false, null, null));
        }
        if (state.stage() == Stage.CLOSED) {
            return Optional.of(reply(ClientMessages.CLOSED_CONVERSATION, state, null, false, null, null));
        }
        return Optional.empty();
    }

    private Response prompt(String text, State state, Intent intent, String key, String label) {
        return reply(text, new State(Stage.AWAITING_QUESTION, state.intakePaused(), true), intent, false, key, label);
    }

    private Response reply(String text, State state, Intent intent, boolean cancel, String key, String label) {
        var rows = mainRows(state);
        return new Response(text, rows.isEmpty() ? Keyboard.REMOVE : Keyboard.REPLY, rows, intent, cancel,
                key, key == null ? null : label);
    }

    private Optional<String> labelForAction(String action) {
        return switch (action) {
            case "main" -> Optional.of("Меню");
            case "handoff" -> Optional.of(ASK);
            case "new_question" -> Optional.of(NEW_QUESTION);
            default -> ClientCatalog.SECTIONS.stream()
                    .filter(section -> section.id().equals(action))
                    .map(ClientCatalog.Section::label)
                    .findFirst()
                    .or(() -> catalog.custom().stream().filter(item -> ("custom:" + item.id()).equals(action))
                            .map(ClientCatalog.Custom::label).findFirst());
        };
    }

    private String actionForLabel(String label) {
        if (ASK.equals(label)) {
            return "handoff";
        }
        if (NEW_QUESTION.equals(label)) {
            return "new_question";
        }
        return ClientCatalog.SECTIONS.stream().filter(section -> section.label().equals(label))
                .map(ClientCatalog.Section::id).findFirst()
                .or(() -> catalog.custom().stream().filter(item -> item.label().equals(label))
                        .map(item -> "custom:" + item.id()).findFirst()).orElse(null);
    }

    private static String command(String label) {
        return "меню".equalsIgnoreCase(label) ? "/menu"
                : label.split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
    }

    private static void pairs(List<List<Button>> rows, List<Button> buttons) {
        for (var start = 0; start < buttons.size(); start += 2) {
            rows.add(List.copyOf(buttons.subList(start, Math.min(buttons.size(), start + 2))));
        }
    }
}
