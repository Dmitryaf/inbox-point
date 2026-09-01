package com.inboxpoint.content;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
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
    private volatile Snapshot content;

    public ClientInformation(@Value("${DATABASE_PATH:./data/messenger-handoff.sqlite}") String database) {
        file = Path.of(database).toAbsolutePath().resolveSibling("content-settings.json");
        try {
            var json = JsonMapper.shared().readTree(Files.readString(file));
            if (json.path("version").asInt() != 1) {
                throw new IllegalArgumentException("Unsupported content settings version");
            }
            content = normalize(json);
        } catch (NoSuchFileException missing) {
            content = new Snapshot(Map.of(), List.of());
        } catch (IOException | RuntimeException invalid) {
            LoggerFactory.getLogger(ClientInformation.class).warn("Saved client information could not be read");
            content = new Snapshot(Map.of(), List.of());
        }
    }

    public Map<String, Object> current() {
        return content.jsonFields();
    }

    public List<Section> sections() {
        return content.custom();
    }

    public synchronized Map<String, Object> save(JsonNode input) throws IOException {
        var next = normalize(input);
        var output = JsonMapper.shared().createObjectNode().put("version", 1);
        next.standard().forEach(output::put);
        if (!next.custom().isEmpty()) {
            var values = output.putArray("customSections");
            for (var section : next.custom()) {
                values.addObject().put("label", section.label()).put("text", section.text());
            }
        }
        LocalJsonFile.write(file, output);
        content = next;
        return next.jsonFields();
    }

    public String resolve(String label) {
        var snapshot = content;
        return switch (label) {
            case SCHEDULE -> snapshot.standard().getOrDefault("schedule", "Расписание" + UNAVAILABLE);
            case PRICES -> snapshot.standard().getOrDefault("prices", "Информация о ценах" + UNAVAILABLE);
            case ADDRESS -> snapshot.standard().getOrDefault("address", "Информация об адресе" + UNAVAILABLE);
            default -> snapshot.custom().stream()
                    .filter(section -> section.label().equals(label)).map(Section::text).findFirst().orElse(null);
        };
    }

    public record Section(String label, String text) { }

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
            sections.add(new Section(label, text));
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
