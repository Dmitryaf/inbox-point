package com.inboxpoint.content;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Set;
import java.util.List;
import java.util.Map;

import com.inboxpoint.persistence.LocalJsonFile;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public final class ClientInformation {
    public static final String SCHEDULE = "Расписание";
    public static final String PRICES = "Цены";
    public static final String ADDRESS = "Адрес";
    public static final String ASK = "Задать вопрос преподавателю";
    public static final String RESET = "Начать новый вопрос";
    private static final String UNAVAILABLE = " пока не добавлено. Вы можете задать вопрос преподавателю.";
    private static final List<String> FIELDS = List.of("schedule", "prices", "address");
    private static final Set<String> RESERVED = Set.of(
            SCHEDULE.toLowerCase(Locale.ROOT), PRICES.toLowerCase(Locale.ROOT), ADDRESS.toLowerCase(Locale.ROOT),
            ASK.toLowerCase(Locale.ROOT), RESET.toLowerCase(Locale.ROOT), "/start", "/menu", "начать");
    private final Path file;
    private volatile State state;

    public ClientInformation(@Value("${DATABASE_PATH:./data/messenger-handoff.sqlite}") String database) {
        file = Path.of(database).toAbsolutePath().resolveSibling("content-settings.json");
        try {
            var json = JsonMapper.shared().readTree(Files.readString(file));
            state = switch (json.path("version").asInt()) {
                case 1 -> new State(normalize(json), List.of());
                case 2 -> new State(normalize(json.path("content")), history(json.path("history")));
                default -> throw new IllegalArgumentException("Unsupported content settings version");
            };
        } catch (NoSuchFileException missing) {
            state = new State(new Snapshot(Map.of(), List.of()), List.of());
        } catch (IOException | RuntimeException invalid) {
            LoggerFactory.getLogger(ClientInformation.class).warn("Saved client information could not be read");
            state = new State(new Snapshot(Map.of(), List.of()), List.of());
        }
    }

    public Map<String, Object> current() {
        return state.content().jsonFields();
    }

    public List<Section> sections() {
        return state.content().custom();
    }

    public synchronized Map<String, Object> save(JsonNode input) throws IOException {
        var next = normalize(input);
        var previous = state;
        var fieldNames = new ArrayList<>(FIELDS);
        fieldNames.add("customSections");
        var changed = fieldNames.stream()
                .filter(name -> !java.util.Objects.equals(previous.content().jsonFields().get(name), next.jsonFields().get(name)))
                .toList();
        if (changed.isEmpty()) {
            return next.jsonFields();
        }
        var revisions = new ArrayList<Change>();
        revisions.add(new Change(Instant.now().toString(), changed));
        revisions.addAll(previous.history().stream().limit(19).toList());
        var output = JsonMapper.shared().createObjectNode().put("version", 2);
        var payload = output.putObject("content");
        next.standard().forEach(payload::put);
        if (!next.custom().isEmpty()) {
            var values = payload.putArray("customSections");
            for (var section : next.custom()) {
                var value = values.addObject().put("label", section.label()).put("text", section.text());
                if (section.format() != null) {
                    value.put("format", section.format());
                }
            }
        }
        var entries = output.putArray("history");
        for (var revision : revisions) {
            var fields = entries.addObject().put("changedAt", revision.changedAt()).putArray("sections");
            revision.sections().forEach(fields::add);
        }
        LocalJsonFile.write(file, output);
        state = new State(next, List.copyOf(revisions));
        return next.jsonFields();
    }

    public String resolve(String label) {
        var snapshot = state.content();
        return switch (label) {
            case SCHEDULE -> snapshot.standard().getOrDefault("schedule", "Расписание" + UNAVAILABLE);
            case PRICES -> snapshot.standard().getOrDefault("prices", "Информация о ценах" + UNAVAILABLE);
            case ADDRESS -> snapshot.standard().getOrDefault("address", "Информация об адресе" + UNAVAILABLE);
            default -> snapshot.custom().stream()
                    .filter(section -> section.label().equals(label)).map(ClientInformation::sectionAnswer).findFirst().orElse(null);
        };
    }

    public record Section(String label, String text,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
            String format) { }

    public record Change(String changedAt, List<String> sections) { }

    private record State(Snapshot content, List<Change> history) { }

    public List<Change> history() {
        return state.history();
    }

    private static List<Change> history(JsonNode array) {
        if (!array.isArray() || array.size() > 20) {
            throw new IllegalArgumentException("Invalid content history");
        }
        var changes = new ArrayList<Change>();
        for (var row : array) {
            var timestamp = row.path("changedAt").asString("");
            Instant.parse(timestamp);
            var sections = new ArrayList<String>();
            for (var section : row.path("sections")) {
                var key = section.asString("");
                if (!FIELDS.contains(key) && !"customSections".equals(key)) {
                    throw new IllegalArgumentException("Unknown content history section");
                }
                sections.add(key);
            }
            if (sections.isEmpty() || sections.size() > 4) {
                throw new IllegalArgumentException("Invalid content history sections");
            }
            changes.add(new Change(timestamp, List.copyOf(sections)));
        }
        return List.copyOf(changes);
    }

    private static String sectionAnswer(Section section) {
        if (!"faq".equals(section.format())) {
            return section.text();
        }
        var items = new ArrayList<String>();
        for (var block : section.text().strip().split("\\R\\s*\\R")) {
            var lines = block.lines().map(String::strip).filter(line -> !line.isEmpty()).toList();
            if (lines.size() < 2) {
                throw new IllegalArgumentException("A question requires an answer");
            }
            items.add("❓ " + lines.getFirst() + "\n" + String.join("\n", lines.subList(1, lines.size())));
        }
        return section.label() + "\n\n" + String.join("\n\n────────\n\n", items);
    }

    private record Snapshot(Map<String, String> standard, List<Section> custom) {
        Map<String, Object> jsonFields() {
            var combined = new LinkedHashMap<String, Object>(standard);
            if (!custom.isEmpty()) {
                combined.put("customSections", custom);
            }
            return Map.copyOf(combined);
        }
    }

    private static Snapshot normalize(JsonNode input) {
        return new Snapshot(fields(input), custom(input.path("customSections")));
    }

    private static List<Section> custom(JsonNode entries) {
        if (entries.isMissingNode()) {
            return List.of();
        }
        if (!entries.isArray() || entries.size() > 6) {
            throw new IllegalArgumentException("Invalid custom information sections");
        }
        var names = new HashSet<String>();
        var sections = new ArrayList<Section>();
        for (var row : entries) {
            var rawLabel = row.path("label");
            var rawText = row.path("text");
            if (!rawLabel.isString() || !rawText.isString()
                    || rawLabel.asString().length() > 40 || rawText.asString().length() > 4000) {
                throw new IllegalArgumentException("Invalid custom information section");
            }
            var label = rawLabel.asString().strip();
            var text = rawText.asString().strip();
            if (label.isEmpty() && text.isEmpty()) {
                continue;
            }
            var normalized = label.toLowerCase(Locale.ROOT);
            if (label.isEmpty() || text.isEmpty() || RESERVED.contains(normalized) || !names.add(normalized)) {
                throw new IllegalArgumentException("Invalid custom information section");
            }
            var formatNode = row.path("format");
            if (!formatNode.isMissingNode() && !"faq".equals(formatNode.asString(""))) {
                throw new IllegalArgumentException("Invalid custom information format");
            }
            var section = new Section(label, text, formatNode.isMissingNode() ? null : "faq");
            sectionAnswer(section);
            sections.add(section);
        }
        return List.copyOf(sections);
    }

    private static Map<String, String> fields(JsonNode input) {
        if (!input.isObject()) {
            throw new IllegalArgumentException("Expected content object");
        }
        var values = new LinkedHashMap<String, String>();
        for (var field : FIELDS) {
            var item = input.path(field);
            if (item.isMissingNode()) {
                continue;
            }
            if (!item.isString() || item.asString().length() > 4000) {
                throw new IllegalArgumentException("Each section must be at most 4000 characters");
            }
            var text = item.asString().strip();
            if (!text.isEmpty()) {
                values.put(field, text);
            }
        }
        return Map.copyOf(values);
    }
}
