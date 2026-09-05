package com.inboxpoint.content;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
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
    public static final String INTAKE_PAUSED =
            "Бот временно не принимает новые обращения.\n\n"
                    + "Используйте резервный способ связи, указанный в описании бота.";
    public static final String SCHEDULE = "Расписание";
    public static final String PRICES = "Цены";
    public static final String ADDRESS = "Адрес";
    public static final String ASK = "Задать вопрос преподавателю";
    public static final String FAQ = "Частые вопросы";
    public static final String RESET = "Начать новый вопрос";
    private static final String UNAVAILABLE = " пока не добавлено. Вы можете задать вопрос преподавателю.";
    private static final List<String> FIELDS = List.of("schedule", "prices", "address");
    private static final Set<String> RESERVED = Set.of(
            SCHEDULE.toLowerCase(Locale.ROOT), PRICES.toLowerCase(Locale.ROOT), ADDRESS.toLowerCase(Locale.ROOT),
            ASK.toLowerCase(Locale.ROOT), RESET.toLowerCase(Locale.ROOT), FAQ.toLowerCase(Locale.ROOT), "/start", "/menu", "начать", "faq");
    private final Path file;
    private volatile State state;

    public ClientInformation(@Value("${DATABASE_PATH:./data/messenger-handoff.sqlite}") String database) {
        file = Path.of(database).toAbsolutePath().resolveSibling("content-settings.json");
        try {
            var json = JsonMapper.shared().readTree(Files.readString(file));
            state = switch (json.path("version").asInt()) {
                case 1 -> new State(migrate(json), List.of());
                case 2 -> new State(migrate(json.path("content")), history(json.path("history")));
                case 3, 4 -> new State(normalize(json.path("content")), history(json.path("history")));
                default -> throw new IllegalArgumentException("Unsupported content settings version");
            };
        } catch (NoSuchFileException missing) {
            state = new State(new Snapshot(Map.of(), List.of(), List.of(), null), List.of());
        } catch (IOException | RuntimeException invalid) {
            LoggerFactory.getLogger(ClientInformation.class).warn("Saved client information could not be read");
            state = new State(new Snapshot(Map.of(), List.of(), List.of(), null), List.of());
        }
    }

    public Map<String, Object> current() {
        return state.content().jsonFields();
    }

    public ManagedSnapshot snapshot() {
        var current = state.content();
        var canonical = JsonMapper.shared().createObjectNode();
        var fields = new java.util.TreeMap<String, Object>(current.jsonFields());
        fields.forEach((key, value) -> {
            if ("faq".equals(key)) {
                var items = canonical.putArray(key);
                for (var item : current.faq()) {
                    items.addObject().put("answer", item.answer()).put("question", item.question());
                }
            } else {
                canonical.set(key, JsonMapper.shared().valueToTree(value));
            }
        });
        try {
            var digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonical.toString().getBytes(StandardCharsets.UTF_8));
            return new ManagedSnapshot(current.jsonFields(), HexFormat.of().formatHex(digest));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    public synchronized ManagedSnapshot save(JsonNode input, String expected) throws IOException {
        requireVersion(expected);
        save(input);
        return snapshot();
    }

    public synchronized ManagedSnapshot restore(int revision, String expected) throws IOException {
        requireVersion(expected);
        return restore(revision) ? snapshot() : null;
    }

    private void requireVersion(String expected) {
        if (!snapshot().version().equals(expected)) {
            throw new VersionConflict();
        }
    }

    public record ManagedSnapshot(Map<String, Object> content, String version) { }

    public static final class VersionConflict extends RuntimeException { }

    public List<Section> sections() {
        return state.content().custom();
    }

    public synchronized Map<String, Object> save(JsonNode input) throws IOException {
        var next = normalize(input);
        for (var label : List.of(SCHEDULE, PRICES, ADDRESS)) {
            var answer = resolve(label, next);
            if (answer.length() > 4000) {
                throw new IllegalArgumentException("Formatted answer is too long");
            }
        }
        var previous = state;
        var fieldNames = new ArrayList<>(FIELDS);
        fieldNames.add("customSections");
        fieldNames.add("faq");
        fieldNames.add("visibleSections");
        var changed = fieldNames.stream()
                .filter(name -> !java.util.Objects.equals(previous.content().jsonFields().get(name), next.jsonFields().get(name)))
                .map(name -> name.equals("visibleSections") ? "visibility" : name)
                .toList();
        if (changed.isEmpty()) {
            return next.jsonFields();
        }
        var revisions = new ArrayList<Change>();
        var newest = previous.history().stream()
                .mapToInt(change -> change.revision() == null ? 0 : change.revision()).max().orElse(0);
        revisions.add(new Change(Instant.now().toString(), changed, newest + 1, next.jsonFields()));
        revisions.addAll(previous.history().stream().limit(19).toList());
        var output = JsonMapper.shared().createObjectNode().put("version", 4);
        var payload = output.putObject("content");
        serialize(payload, next);
        var entries = output.putArray("history");
        for (var revision : revisions) {
            var row = entries.addObject().put("changedAt", revision.changedAt());
            if (revision.revision() != null) {
                row.put("revision", revision.revision());
                row.set("content", JsonMapper.shared().valueToTree(revision.content()));
            }
            var fields = row.putArray("sections");
            revision.sections().forEach(fields::add);
        }
        LocalJsonFile.write(file, output);
        state = new State(next, List.copyOf(revisions));
        return next.jsonFields();
    }

    private static void serialize(tools.jackson.databind.node.ObjectNode payload, Snapshot next) {
        next.standard().forEach(payload::put);
        if (next.visible() != null) {
            var fields = payload.putArray("visibleSections");
            next.visible().forEach(fields::add);
        }
        if (!next.custom().isEmpty()) {
            var values = payload.putArray("customSections");
            for (var section : next.custom()) {
                values.addObject().put("label", section.label()).put("text", section.text());
            }
        }
        if (!next.faq().isEmpty()) {
            var faq = payload.putArray("faq");
            for (var answer : next.faq()) {
                faq.addObject().put("question", answer.question()).put("answer", answer.answer());
            }
        }

    }

    public List<String> informationButtons() {
        var current = state.content();
        var buttons = new ArrayList<String>();
        if (current.standard().containsKey("schedule") && current.includes("schedule")) {
            buttons.add(SCHEDULE);
        }
        if (current.standard().containsKey("prices") && current.includes("prices")) {
            buttons.add(PRICES);
        }
        if (current.standard().containsKey("address") && current.includes("address")) {
            buttons.add(ADDRESS);
        }
        if (!current.faq().isEmpty() && current.includes("faq")) {
            buttons.add(FAQ);
        }
        return List.copyOf(buttons);
    }

    public String resolve(String label) {
        return resolve(label, state.content());
    }

    private static String resolve(String label, Snapshot snapshot) {
        if (FAQ.equals(label) || "faq".equalsIgnoreCase(label)) {
            return snapshot.faq().isEmpty() ? FAQ + UNAVAILABLE : formatFaq(snapshot.faq());
        }
        return switch (label) {
            case SCHEDULE -> formatList(SCHEDULE, snapshot.standard().get("schedule"), "Расписание" + UNAVAILABLE);
            case PRICES -> formatList(PRICES, snapshot.standard().get("prices"), "Информация о ценах" + UNAVAILABLE);
            case ADDRESS -> snapshot.standard().containsKey("address")
                    ? "Адрес\n\n" + snapshot.standard().get("address") : "Информация об адресе" + UNAVAILABLE;
            default -> snapshot.custom().stream()
                    .filter(section -> section.label().equals(label)).map(Section::text).findFirst().orElse(null);
        };
    }

    public record Section(String label, String text) { }

    public record Faq(String question, String answer) { }

    public record Change(String changedAt,
            List<String> sections,
            @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
            Integer revision,
            @com.fasterxml.jackson.annotation.JsonIgnore Map<String, Object> content) { }

    public synchronized boolean restore(int revision) throws IOException {
        for (var change : state.history()) {
            if (change.revision() != null && change.revision() == revision && change.content() != null) {
                save(JsonMapper.shared().valueToTree(change.content()));
                return true;
            }
        }
        return false;
    }

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
                if (!FIELDS.contains(key) && !List.of("customSections", "faq", "visibility").contains(key)) {
                    throw new IllegalArgumentException("Unknown content history section");
                }
                sections.add(key);
            }
            if (sections.isEmpty() || sections.size() > 6) {
                throw new IllegalArgumentException("Invalid content history sections");
            }
            var revision = row.path("revision").asInt(0);
            if (revision < 0 || (revision == 0 && row.has("revision"))) {
                throw new IllegalArgumentException("Invalid content revision");
            }
            var payload = revision > 0 ? normalize(row.path("content")).jsonFields() : null;
            changes.add(new Change(timestamp, List.copyOf(sections), revision == 0 ? null : revision, payload));
        }
        return List.copyOf(changes);
    }

    private static String formatList(String label, String value, String fallback) {
        if (value == null) {
            return fallback;
        }
        var items = value.lines().map(String::strip).map(line -> line.replaceFirst("^[-•]\\s*", ""))
                .filter(line -> !line.isEmpty()).map(line -> "• " + line).toList();
        return label + "\n\n" + String.join("\n", items);
    }

    private static String formatFaq(List<Faq> items) {
        return FAQ + "\n\n" + String.join("\n\n────────\n\n",
                items.stream().map(item -> "❓ " + item.question() + "\n" + item.answer()).toList());
    }

    private static List<Faq> faq(JsonNode entries) {
        if (entries.isMissingNode()) {
            return List.of();
        }
        if (!entries.isArray() || entries.size() > 20) {
            throw new IllegalArgumentException("Invalid FAQ sections");
        }
        var items = new ArrayList<Faq>();
        for (var item : entries) {
            var question = item.path("question");
            var answer = item.path("answer");
            if (!question.isString() || !answer.isString()
                    || question.asString().length() > 300 || answer.asString().length() > 3000) {
                throw new IllegalArgumentException("Invalid FAQ item");
            }
            var plainQuestion = question.asString().strip();
            var plainAnswer = answer.asString().strip();
            if (plainAnswer.isEmpty() && plainQuestion.isEmpty()) {
                continue;
            }
            if (plainAnswer.isEmpty() || plainQuestion.isEmpty()) {
                throw new IllegalArgumentException("A question requires an answer");
            }
            items.add(new Faq(plainQuestion, plainAnswer));
        }
        if (formatFaq(items).length() > 4000) {
            throw new IllegalArgumentException("FAQ exceeds the supported message length");
        }
        return List.copyOf(items);
    }

    private static Snapshot migrate(JsonNode previous) {
        var cleaned = JsonMapper.shared().createObjectNode();
        var sections = cleaned.putArray("customSections");
        var questions = cleaned.putArray("faq");
        for (var row : previous.path("customSections")) {
            if (!"faq".equals(row.path("format").asString(""))) {
                sections.add(row);
                continue;
            }
            for (var block : row.path("text").asString("").strip().split("\\R\\s*\\R")) {
                var lines = block.lines().map(String::strip).filter(line -> !line.isEmpty()).toList();
                if (lines.size() >= 2) {
                    questions.addObject().put("question", lines.getFirst())
                            .put("answer", String.join("\n", lines.subList(1, lines.size())));
                }
            }
        }
        return new Snapshot(fields(previous), custom(sections), faq(questions), null);
    }

    private record Snapshot(Map<String, String> standard, List<Section> custom, List<Faq> faq,
            List<String> visible) {
        boolean includes(String section) {
            return visible == null || visible.contains(section);
        }

        Map<String, Object> jsonFields() {
            var combined = new LinkedHashMap<String, Object>(standard);
            if (!custom.isEmpty()) {
                combined.put("customSections", custom);
            }
            if (!faq.isEmpty()) {
                combined.put("faq", faq);
            }
            if (visible != null) {
                combined.put("visibleSections", visible);
            }
            return Map.copyOf(combined);
        }
    }

    private static Snapshot normalize(JsonNode input) {
                return new Snapshot(fields(input), custom(input.path("customSections")), faq(input.path("faq")),
                visibility(input.path("visibleSections")));
    }

    private static List<String> visibility(JsonNode array) {
        if (array.isMissingNode()) {
            return null;
        }
        if (!array.isArray() || array.size() > 4) {
            throw new IllegalArgumentException("Invalid section visibility");
        }
        var configured = new ArrayList<String>();
        for (var value : array) {
            var key = value.asString("");
            if ((!FIELDS.contains(key) && !"faq".equals(key)) || configured.contains(key)) {
                throw new IllegalArgumentException("Invalid section visibility");
            }
            configured.add(key);
        }
        return List.copyOf(configured);
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
            if (row.has("format")) {
                throw new IllegalArgumentException("Custom sections contain plain text");
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
