package com.inboxpoint.content;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class ClientCatalog {
    static final List<Section> SECTIONS = List.of(new Section("schedule", "Расписание"),
            new Section("prices", "Цены"), new Section("address", "Адрес"), new Section("faq", "Частые вопросы"));
    private static final JsonMapper JSON = JsonMapper.shared();

    record Section(String id, String label) { }

    record Custom(String id, String label, String text, boolean application) { }

    record Direction(String id, String name) { }

    record Group(String id, String directionId, String name, List<String> meetings, String description,
            boolean open, String question, String confirmation, String review) { }

    record Keyword(String phrase, String groupId) { }

    record ScheduleEntry(String title, String time, String description) { }

    private record Faq(String question, String answer) { }

    private final List<Direction> directions;
    private final List<Group> groups;
    private final List<Keyword> keywords;
    private final List<Custom> custom;
    private final List<Faq> faq;
    private final String prices;
    private final String address;
    private final List<Section> informationButtons;
    private final Set<String> history;

    ClientCatalog(JsonNode content, Set<String> history) {
        if (!content.isObject()) {
            throw invalidDocument();
        }
        var storedDirections = list(content, "directions",
                item -> new Direction(required(item, "id"), required(item, "name")));
        var storedGroups = list(content, "groups", ClientCatalog::group);
        keywords = list(content, "keywords", item -> "group".equals(required(item, "targetType"))
                ? new Keyword(required(item, "phrase"), required(item, "targetId")) : null);
        custom = list(content, "customSections", ClientCatalog::custom);
        var schedule = list(content, "scheduleItems",
                item -> new ScheduleEntry(required(item, "title"), required(item, "dayTime"), text(item, "description")));
        faq = list(content, "faq", item -> new Faq(required(item, "question"), required(item, "answer")));
        var classes = LegacySchedule.migrate(storedDirections, storedGroups, schedule,
                content.has("scheduleItems") ? "" : text(content, "schedule"));
        directions = classes.directions();
        groups = classes.groups();
        prices = text(content, "prices");
        address = text(content, "address");
        var visibility = content.path("visibleSections");
        var visible = visibility.isMissingNode() ? SECTIONS.stream().map(Section::id).toList()
                : strings(visibility);
        informationButtons = SECTIONS.stream()
                .filter(section -> visible.contains(section.id()) && hasSection(section.id()))
                .toList();
        this.history = Set.copyOf(history);
    }

    public static ClientCatalog load(Path path) throws IOException {
        try {
            return parse(Files.readString(path, StandardCharsets.UTF_8));
        } catch (NoSuchFileException missing) {
            return new ClientCatalog(JSON.createObjectNode(), Set.of());
        }
    }

    public static ClientCatalog parse(String document) {
        JsonNode root;
        try {
            root = JSON.readTree(document);
        } catch (JacksonException failure) {
            throw invalidDocument();
        }
        if (root == null || !root.isObject()) {
            throw invalidDocument();
        }
        var version = root.path("formatVersion");
        if (!version.isMissingNode() && (!version.isIntegralNumber()
                || (version.asInt() != 2 && version.asInt() != 3))) {
            throw invalidDocument();
        }
        var history = new HashSet<String>();
        if (root.has("previousMenuActions")) {
            history.addAll(strings(root.path("previousMenuActions")));
        }
        for (var revision : list(root, "history", item -> new ClientCatalog(item.path("content"), Set.of()))) {
            revision.informationButtons.forEach(section -> history.add(section.label()));
            revision.custom.forEach(section -> history.add(section.label()));
        }
        return new ClientCatalog(root.path("content"), history);
    }

    List<Direction> directions() {
        return directions;
    }

    List<Group> groups() {
        return groups;
    }

    List<Keyword> keywords() {
        return keywords;
    }

    List<Custom> custom() {
        return custom;
    }

    List<Section> informationButtons() {
        return informationButtons;
    }

    boolean stale(String label) {
        return history.contains(label) && informationButtons.stream().noneMatch(section -> section.label().equals(label))
                && custom.stream().noneMatch(section -> section.label().equals(label));
    }

    Optional<String> sectionText(String label) {
        return switch (label) {
            case "Расписание" -> Optional.of(scheduleText());
            case "Цены" -> Optional.of(prices.isBlank() ? "Цены пока не указаны." : listText(label, prices));
            case "Адрес" -> Optional.of(address.isBlank() ? "Адрес пока не указан." : label + "\n\n" + address);
            case "Частые вопросы" -> Optional.of(faq.isEmpty() ? "Раздел с частыми вопросами пока пуст."
                    : label + "\n\n" + String.join("\n\n────────\n\n",
                            faq.stream().map(item -> "❓ " + item.question() + "\n" + item.answer()).toList()));
            default -> custom.stream().filter(section -> section.label().equals(label)).map(Custom::text).findFirst();
        };
    }

    String title(Group group) {
        var direction = directions.stream().filter(item -> item.id().equals(group.directionId())).findFirst();
        return direction.map(Direction::name).orElse("") + " / " + group.name();
    }

    static String normalizeLabel(String label) {
        return label.strip().replaceAll("(?U)\\s+", " ").toLowerCase(Locale.ROOT);
    }

    String scheduleText() {
        if (!groups.isEmpty()) {
            return "Расписание\n\n" + String.join("\n\n", groups.stream().map(group -> group.review() != null
                    ? group.review()
                    : title(group) + "\n" + String.join("\n", group.meetings())
                        + withPrefix("\n", group.description())).toList());
        }
        return "Расписание пока не указано.";
    }

    private boolean hasSection(String id) {
        return switch (id) {
            case "schedule" -> !groups.isEmpty() || !directions.isEmpty();
            case "prices" -> !prices.isBlank();
            case "address" -> !address.isBlank();
            case "faq" -> !faq.isEmpty();
            default -> false;
        };
    }

    private static Group group(JsonNode item) {
        var status = item.path("enrollmentOpen");
        if (!status.isBoolean()) {
            throw invalidDocument();
        }
        var review = item.has("review") ? text(item.path("review"), "source") : null;
        var meetings = strings(item.path("meetings"));
        var id = required(item, "id");
        if (!id.matches("[A-Za-z0-9_-]{1,36}") || (review == null && meetings.isEmpty()) || "".equals(review)) {
            throw invalidDocument();
        }
        return new Group(id, text(item, "directionId"), text(item, "name"), meetings, text(item, "description"),
                review == null && status.booleanValue(), text(item, "applicationQuestion"), text(item, "confirmationText"),
                review);
    }

    private static Custom custom(JsonNode item) {
        var label = required(item, "label");
        var id = text(item, "id");
        if (id.isEmpty()) {
            id = UUID.nameUUIDFromBytes(label.getBytes(StandardCharsets.UTF_8)).toString();
        }
        var mode = text(item, "mode");
        if (!mode.isEmpty() && !mode.equals("information") && !mode.equals("application")) {
            throw invalidDocument();
        }
        return new Custom(id, label, required(item, "text"), "application".equals(mode));
    }

    private static <T> List<T> list(JsonNode node, String field, Function<JsonNode, T> read) {
        var value = node.path(field);
        if (value.isMissingNode()) {
            return List.of();
        }
        if (!value.isArray()) {
            throw invalidDocument();
        }
        var result = new ArrayList<T>();
        for (var element : value) {
            var parsed = read.apply(element);
            if (parsed != null) {
                result.add(parsed);
            }
        }
        return List.copyOf(result);
    }

    private static List<String> strings(JsonNode value) {
        if (!value.isArray()) {
            throw invalidDocument();
        }
        var list = new ArrayList<String>();
        for (var item : value) {
            if (!item.isString()) {
                throw invalidDocument();
            }
            list.add(item.asString());
        }
        return List.copyOf(list);
    }

    private static String text(JsonNode node, String field) {
        var value = node.path(field);
        if (value.isMissingNode()) {
            return "";
        }
        if (!value.isString()) {
            throw invalidDocument();
        }
        return value.asString();
    }

    private static String required(JsonNode node, String field) {
        var text = text(node, field);
        if (text.isBlank()) {
            throw invalidDocument();
        }
        return text;
    }

    static String listText(String label, String body) {
        var entries = body.lines().map(line -> line.strip().replaceFirst("^[-•]\\s*", ""))
                .filter(line -> !line.isEmpty()).map(line -> "• " + line).toList();
        return label + "\n\n" + String.join("\n", entries);
    }

    private static String withPrefix(String prefix, String text) {
        return text.isEmpty() ? "" : prefix + text;
    }

    private static IllegalArgumentException invalidDocument() {
        return new IllegalArgumentException("The local content settings are invalid");
    }
}
