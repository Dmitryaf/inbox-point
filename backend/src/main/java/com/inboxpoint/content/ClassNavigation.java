package com.inboxpoint.content;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.IntFunction;
import java.util.regex.Pattern;

import com.inboxpoint.content.ClassMenu.Button;
import com.inboxpoint.content.ClassMenu.Intent;
import com.inboxpoint.content.ClassMenu.Keyboard;
import com.inboxpoint.content.ClassMenu.Response;
import com.inboxpoint.content.ClassMenu.Stage;
import com.inboxpoint.content.ClassMenu.State;

final class ClassNavigation {
    private static final Button MENU = button("Меню", "main");
    private static final Button DIRECTIONS = new Button("Другие направления", "classes:directions:0", "Направления: 1");
    private static final String NO_SCHEDULE = "Расписание пока не указано.";
    private static final String DEFAULT_QUESTION = "В какой день хотите прийти?";
    private static final Pattern NUMBERED = Pattern.compile(
            "^(направления|занятия|расписание всех направлений): ([0-9]+)$");
    private final ClientCatalog catalog;

    ClassNavigation(ClientCatalog catalog) {
        this.catalog = catalog;
    }

    Optional<Response> resolve(String label, boolean explicit, State state, boolean showSchedule) {
        if (showSchedule && "Расписание".equals(label) && (explicit || state.stage() != Stage.AWAITING_QUESTION)
                && (!catalog.directions().isEmpty() || !catalog.groups().isEmpty())) {
            return Optional.of(render("classes:directions:0", state));
        }
        if (explicit || state.stage() == Stage.AWAITING_QUESTION || state.awaitingQuestion()
                || label.startsWith("/") || "меню".equalsIgnoreCase(label)) {
            return Optional.empty();
        }
        var word = normalize(label);
        var keyword = catalog.keywords().stream().filter(item -> "group".equals(item.targetType()) && normalize(item.phrase()).equals(word)).findFirst();
        if (keyword.isPresent()) {
            var item = keyword.get();
            return Optional.of(render("classes:group:" + item.targetId(), state));
        }
        if (state.stage() == Stage.ACTIVE && !label.contains(":")) {
            return Optional.empty();
        }
        return Optional.ofNullable(textAction(word)).map(action -> render(action, state));
    }

    Response render(String action, State state) {
        var parts = action.split(":", -1);
        var operation = parts.length > 1 ? parts[1] : "";
        var id = parts.length > 2 ? parts[2] : "";
        return switch (operation) {
            case "directions" -> directions(id);
            case "direction" -> direction(id, parts.length > 3 ? parts[3] : "");
            case "legacy" -> inline(catalog.scheduleText(), List.of(DIRECTIONS, MENU));
            case "review", "all" -> schedule(operation, id);
            default -> renderGroup(operation, id, state);
        };
    }

    private Response directions(String id) {
        var all = catalog.directions();
        if (all.isEmpty() && catalog.groups().stream().anyMatch(group -> group.review() != null)) {
            return schedule("review", "0");
        }
        var page = page(id, all.size(), 2);
        var buttons = new ArrayList<Button>();
        pageItems(all, page).forEach(direction -> buttons.add(new Button(direction.name(),
                "classes:direction:" + direction.id() + ":0", "Направление: " + direction.name())));
        pageButtons(buttons, page, all.size(), 2, next -> "classes:directions:" + next,
                next -> "Направления: " + (next + 1));
        if (!catalog.groups().isEmpty()) {
            buttons.add(button("Расписание всех направлений", "classes:all:0"));
        } else if (catalog.hasLegacySchedule()) {
            buttons.add(new Button("Другие занятия", "classes:legacy", "Занятия: общие"));
        }
        buttons.add(MENU);
        return inline("Расписание\n\nВыберите направление." + pageLabel(all.size(), page, "\n"), buttons);
    }

    private Response direction(String id, String currentPage) {
        var item = catalog.directions().stream().filter(direction -> direction.id().equals(id)).findFirst();
        if (item.isEmpty()) {
            return updated();
        }
        var name = item.get().name();
        var all = catalog.groups().stream().filter(group -> group.directionId().equals(id) && group.review() == null)
                .toList();
        var page = page(currentPage, all.size(), 2);
        var buttons = new ArrayList<Button>();
        pageItems(all, page).forEach(group -> buttons.add(new Button(group.name(), "classes:group:" + group.id(),
                "Группа: " + catalog.title(group))));
        pageButtons(buttons, page, all.size(), 2, next -> "classes:direction:" + id + ":" + next,
                next -> "Группы: " + name + ": " + (next + 1));
        buttons.add(DIRECTIONS);
        buttons.add(MENU);
        return inline(name + "\n\n" + (all.isEmpty() ? "Группы пока не добавлены." : "Выберите группу.")
                + pageLabel(all.size(), page, "\n\n"), buttons, null, "direction:" + id, "Направление: " + name);
    }

    private Response schedule(String operation, String pageText) {
        var all = "all".equals(operation);
        var source = all ? catalog.allGroupsSchedule().replaceFirst("^Расписание\n\n", "")
                : String.join("\n\n", catalog.groups().stream().map(ClientCatalog.Group::review)
                        .filter(java.util.Objects::nonNull).toList());
        var pages = new ArrayList<String>();
        for (var start = 0; start < source.length();) {
            var end = Math.min(start + 3000, source.length());
            if (end < source.length() && Character.isHighSurrogate(source.charAt(end - 1))) {
                end--;
            }
            pages.add(source.substring(start, end));
            start = end;
        }
        var page = page(pageText, pages.size(), 1);
        var buttons = new ArrayList<Button>();
        pageButtons(buttons, page, pages.size(), 1, next -> "classes:" + operation + ":" + next,
                next -> (all ? "Расписание всех направлений: " : "Занятия: ") + (next + 1));
        buttons.add(DIRECTIONS);
        buttons.add(MENU);
        return inline((all ? "Расписание всех направлений" : "Расписание") + "\n\n"
                + (pages.isEmpty() ? NO_SCHEDULE : pages.get(page)), buttons);
    }

    private Response renderGroup(String operation, String id, State state) {
        var item = catalog.groups().stream().filter(group -> group.id().equals(id)).findFirst();
        if (item.isEmpty()) {
            return updated();
        }
        var group = item.get();
        if (group.review() != null) {
            return schedule("review", "0");
        }
        var title = catalog.title(group);
        var back = new Button("К группе", "classes:group:" + id, "Группа: " + title);
        var intakeAllowed = !state.intakePaused() || state.stage() == Stage.ACTIVE;
        var canEnroll = group.open() && intakeAllowed;
        var enroll = new Button("Записаться на занятие", "classes:signup:" + id, "Записаться: " + title);
        return switch (operation) {
            case "signup", "question" -> prompt(group, title, back, "signup".equals(operation), intakeAllowed);
            case "prices" -> inline(catalog.sectionText("Цены").orElseThrow(), List.of(back, MENU));
            case "times" -> inline(title + "\n\n" + String.join("\n", group.meetings()),
                    canEnroll ? List.of(enroll, back, MENU) : List.of(back, MENU));
            case "group" -> groupCard(group, title, intakeAllowed, enroll, canEnroll);
            default -> updated();
        };
    }

    private Response groupCard(ClientCatalog.Group group, String title, boolean intakeAllowed,
            Button enroll, boolean canEnroll) {
        var buttons = new ArrayList<Button>();
        if (canEnroll) {
            buttons.add(enroll);
        }
        buttons.add(new Button("Цены", "classes:prices:" + group.id(), "Цены: " + title));
        if (intakeAllowed) {
            buttons.add(new Button("Задать вопрос", "classes:question:" + group.id(), "Вопрос: " + title));
        }
        buttons.add(DIRECTIONS);
        buttons.add(MENU);
        return inline(title + "\n\n" + (group.description().isEmpty() ? "" : group.description() + "\n\n")
                + String.join("\n", group.meetings()) + "\n\n"
                + (group.open() ? "Набор открыт.\n" : "") + "Выберите нужное действие.",
                buttons, null, "group:" + group.id(), "Группа: " + title);
    }

    private Response prompt(ClientCatalog.Group group, String title, Button back, boolean signup, boolean intakeAllowed) {
        if (!intakeAllowed) {
            return inline("Сейчас мы временно не принимаем новые вопросы. Попробуйте написать позже или свяжитесь с нами по контактам в описании.", List.of(back, MENU));
        }
        if (signup && !group.open()) {
            return inline(title + "\n\nЧтобы уточнить запись на занятие, откройте группу и нажмите «Задать вопрос».",
                    List.of(back, DIRECTIONS, MENU));
        }
        var intent = new Intent(signup ? title : null, signup ? null : title,
                !signup ? null : group.confirmation().isBlank() ? "Ваша запись подтверждена. Ждём вас на занятии!" : group.confirmation());
        var question = group.question().isBlank()
                || "Как к вам обращаться и на какое занятие планируете прийти?".equals(group.question().strip())
                ? DEFAULT_QUESTION : group.question();
        return inline(title + "\n\n" + (signup ? question + "\n" : "Напишите свой вопрос. Мы ответим здесь.")
                + "\nЧтобы отменить, напишите «Меню».", List.of(MENU), intent,
                (signup ? "signup:" : "group_question:") + group.id(),
                (signup ? "Начало записи: " : "Вопрос о группе: ") + title);
    }

    private String textAction(String text) {
        if ("другие направления".equals(text)) {
            return "classes:directions:0";
        }
        if (("другие занятия".equals(text) || "занятия: общие".equals(text)) && !catalog.directions().isEmpty()) {
            return "classes:legacy";
        }
        if ("расписание всех направлений".equals(text)) {
            return "classes:all:0";
        }
        var numbered = NUMBERED.matcher(text);
        if (numbered.matches()) {
            var kind = switch (numbered.group(1)) {
                case "направления" -> "directions";
                case "занятия" -> "review";
                default -> "all";
            };
            return "classes:" + kind + ":" + previousIndex(numbered.group(2));
        }
        for (var direction : catalog.directions()) {
            var name = normalize(direction.name());
            if (text.equals("направление: " + name)) {
                return "classes:direction:" + direction.id() + ":0";
            }
            var prefix = "группы: " + name + ": ";
            if (text.startsWith(prefix) && text.substring(prefix.length()).matches("[0-9]+")) {
                return "classes:direction:" + direction.id() + ":" + previousIndex(text.substring(prefix.length()));
            }
        }
        var labels = List.of("группа", "расписание", "записаться", "цены", "вопрос");
        var operations = List.of("group", "times", "signup", "prices", "question");
        for (var group : catalog.groups()) {
            var title = normalize(catalog.title(group));
            for (var i = 0; i < labels.size(); i++) {
                if (text.equals(labels.get(i) + ": " + title)) {
                    return "classes:" + operations.get(i) + ":" + group.id();
                }
            }
        }
        return null;
    }

    private static String normalize(String text) {
        return ClientCatalog.normalizeLabel(text);
    }

    private static int previousIndex(String number) {
        try {
            return Integer.parseInt(number) - 1;
        } catch (NumberFormatException failure) {
            return 0;
        }
    }

    private static int page(String number, int length, int size) {
        try {
            return Math.clamp(Integer.parseInt(number), 0, Math.max(0, Math.ceilDiv(length, size) - 1));
        } catch (NumberFormatException failure) {
            return 0;
        }
    }

    private static <T> List<T> pageItems(List<T> items, int page) {
        return items.subList(page * 2, Math.min(page * 2 + 2, items.size()));
    }

    private static String pageLabel(int length, int page, String spacing) {
        return length > 2 ? spacing + "Страница " + (page + 1) + " из " + Math.ceilDiv(length, 2) + "." : "";
    }

    private static void pageButtons(List<Button> buttons, int page, int length, int size,
            IntFunction<String> action, IntFunction<String> command) {
        if (page > 0) {
            buttons.add(new Button("Назад", action.apply(page - 1), command.apply(page - 1)));
        }
        if (length > (page + 1) * size) {
            buttons.add(new Button("Далее", action.apply(page + 1), command.apply(page + 1)));
        }
    }

    private static Button button(String label, String action) {
        return new Button(label, action, label);
    }

    private static Response updated() {
        return inline("Эта кнопка больше не используется. Выберите другое действие ниже.", List.of(MENU));
    }

    private static Response inline(String text, List<Button> buttons) {
        return inline(text, buttons, null, null, null);
    }

    private static Response inline(String text, List<Button> buttons, Intent intent, String key, String label) {
        return new Response(text, Keyboard.INLINE, buttons.stream().map(List::of).toList(), intent, false, key, label);
    }
}
