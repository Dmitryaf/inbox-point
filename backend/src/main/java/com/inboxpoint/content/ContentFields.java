package com.inboxpoint.content;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.inboxpoint.content.ContentShape.JSON;
import static com.inboxpoint.content.ContentShape.array;
import static com.inboxpoint.content.ContentShape.object;
import static com.inboxpoint.content.ContentShape.require;
import static com.inboxpoint.content.ContentShape.singleLine;
import static com.inboxpoint.content.ContentShape.text;
import static com.inboxpoint.content.ContentShape.trim;

final class ContentFields {
    static final ArrayNode DEFAULT_VISIBILITY = JSON.createArrayNode().add("schedule").add("prices").add("address").add("faq");
    private static final Set<String> RESERVED = new HashSet<>();

    static {
        ContentShape.RESERVED_LABELS.forEach(label -> RESERVED.add(label.toLowerCase(Locale.ROOT)));
    }

    private ContentFields() { }

    static ObjectNode stored(JsonNode input) {
        return collect(input, null, false);
    }

    static ObjectNode submitted(JsonNode input, ObjectNode current) {
        return collect(input, current, true);
    }

    private static ObjectNode collect(JsonNode input, ObjectNode current, boolean submitted) {
        object(input, submitted, "organizationName", "directions", "groups", "keywords", "address", "customSections",
                "faq", "prices", "schedule", "scheduleItems", "visibleSections");
        var result = JSON.createObjectNode();
        if (input.has("organizationName")) {
            var name = text(input.path("organizationName"), submitted ? 0 : 1, 120, true);
            singleLine(name);
            if (!name.isEmpty()) {
                result.put("organizationName", name);
            }
        } else if (submitted && current.has("organizationName")) {
            result.set("organizationName", current.path("organizationName"));
        }

        ContentClasses.copy(input, current, result, submitted);
        addText(result, input, "address", submitted);
        if (input.has("customSections")) {
            putCollection(result, "customSections", customSections(input.path("customSections"), submitted), submitted);
        }
        if (input.has("faq")) {
            putCollection(result, "faq", faq(input.path("faq"), submitted), submitted);
        }
        addText(result, input, "prices", submitted);
        schedule(input, result, submitted);
        if (input.has("visibleSections")) {
            var sections = result.putArray("visibleSections");
            var seen = new HashSet<String>();
            for (var item : array(input.path("visibleSections"), 4)) {
                var id = text(item, 1, 10, false);
                require(ClientCatalog.SECTIONS.stream().anyMatch(section -> section.id().equals(id)) && seen.add(id));
                sections.add(id);
            }
        } else if (submitted) {
            result.set("visibleSections", DEFAULT_VISIBILITY.deepCopy());
        }
        validateResponses(result);
        return result;
    }

    private static void addText(ObjectNode result, JsonNode input, String key, boolean submitted) {
        if (submitted || input.has(key)) {
            var value = text(input.path(key), submitted ? 0 : 1, 4000, false);
            value = submitted ? trim(value) : value;
            if (!value.isEmpty()) {
                result.put(key, value);
            }
        }
    }

    private static void putCollection(ObjectNode result, String key, ArrayNode values, boolean submitted) {
        if (!submitted || !values.isEmpty()) {
            result.set(key, values);
        }
    }

    private static ArrayNode customSections(JsonNode input, boolean submitted) {
        var result = JSON.createArrayNode();
        var labels = new HashSet<String>();
        var ids = new HashSet<String>();
        for (var item : array(input, 6)) {
            object(item, submitted, "mode", "id", "label", "text");
            var label = line(item.path("label"), 40, submitted);
            var body = line(item.path("text"), 4000, submitted);
            var field = JSON.createObjectNode();
            if (item.has("mode")) {
                var mode = text(item.path("mode"), 1, 16, false);
                require("information".equals(mode) || "application".equals(mode));
                field.put("mode", mode);
            }
            var id = item.has("id") ? text(item.path("id"), 1, 80, false) : null;
            require(id == null || id.matches("[A-Za-z0-9_-]+"));
            if (label.isEmpty() && body.isEmpty()) {
                continue;
            }
            var normalized = label.toLowerCase(Locale.ROOT);
            require(!label.isEmpty() && !body.isEmpty() && !RESERVED.contains(normalized) && labels.add(normalized));
            field.put("label", label).put("text", body);
            if (id != null) {
                require(ids.add(id));
                field.put("id", id);
            }
            result.add(field);
        }
        return result;
    }

    private static ArrayNode faq(JsonNode input, boolean submitted) {
        var result = JSON.createArrayNode();
        for (var item : array(input, 20)) {
            object(item, submitted, "answer", "question");
            var answer = line(item.path("answer"), 3000, submitted);
            var question = line(item.path("question"), 300, submitted);
            if (answer.isEmpty() && question.isEmpty()) {
                continue;
            }
            require(!answer.isEmpty() && !question.isEmpty());
            result.addObject().put("answer", answer).put("question", question);
        }
        return result;
    }

    private static String line(JsonNode value, int max, boolean submitted) {
        var raw = text(value, submitted ? 0 : 1, max, false);
        var normalized = trim(raw);
        require(submitted || raw.equals(normalized));
        return normalized;
    }

    private static void schedule(JsonNode input, ObjectNode result, boolean submitted) {
        var raw = submitted || input.has("schedule")
                ? text(input.path("schedule"), submitted ? 0 : 1, 4000, false) : "";
        var schedule = JSON.createArrayNode();
        var compatibility = new ArrayList<String>();
        var replies = new ArrayList<String>();
        if (input.has("scheduleItems")) {
            for (var item : array(input.path("scheduleItems"), 20)) {
                object(item, submitted, "dayTime", "description", "title");
                var day = line(item.path("dayTime"), 120, submitted);
                var title = line(item.path("title"), 120, submitted);
                singleLine(text(item.path("dayTime"), 0, 120, false));
                singleLine(text(item.path("title"), 0, 120, false));
                var description = item.has("description") ? line(item.path("description"), 1000, submitted) : "";
                if (!submitted) {
                    var row = schedule.addObject().put("dayTime", day);
                    if (!description.isEmpty()) {
                        row.put("description", description);
                    }
                    row.put("title", title);
                    compatibility.add(title + " — " + day + (description.isEmpty() ? "" : " — " + description.replaceAll("\\r?\\n", " ")));
                    replies.add(title + "\n" + day + (description.isEmpty() ? "" : "\n" + description));
                }
            }
            if (!submitted) {
                require(!schedule.isEmpty() && raw.equals(String.join("\n", compatibility))
                        && ("Расписание\n\n" + String.join("\n\n", replies)).length() <= 4000);
            }
        }
        if (submitted && (!trim(raw).isEmpty() || (input.has("scheduleItems") && !input.path("scheduleItems").isEmpty()))) {
            throw new LegacyScheduleEdit();
        }
        if (!submitted && !raw.isEmpty()) {
            require(ClientCatalog.listText("Расписание", raw).length() <= 4000);
            result.put("schedule", raw);
            if (!schedule.isEmpty()) {
                result.set("scheduleItems", schedule);
            }
        }
    }

    static boolean assignSectionIds(ObjectNode content, JsonNode previous, boolean legacy) {
        var sections = content.path("customSections");
        var used = new HashSet<String>();
        sections.forEach(section -> {
            if (section.has("id")) {
                used.add(section.path("id").asString());
            }
        });
        boolean changed = false;
        for (var raw : sections) {
            var section = (ObjectNode) raw;
            if (section.has("id")) {
                continue;
            }
            var label = section.path("label").asString();
            String id = null;
            for (var candidate : previous.path("customSections")) {
                if (candidate.path("label").asString().equals(label) && candidate.has("id")) {
                    var existing = candidate.path("id").asString();
                    if (!used.contains(existing)) {
                        id = existing;
                        break;
                    }
                }
            }
            if (id == null && legacy) {
                var deterministic = UUID.nameUUIDFromBytes(label.getBytes(StandardCharsets.UTF_8)).toString();
                id = used.contains(deterministic) ? null : deterministic;
            }
            if (id == null) {
                id = UUID.randomUUID().toString();
            }
            used.add(id);
            section.put("id", id);
            changed = true;
        }
        return changed;
    }

    static ObjectNode migrateSchedule(ObjectNode content) {
        if (!content.has("schedule")) {
            return content;
        }
        var catalog = new ClientCatalog(content, Set.of());
        var migrated = content.deepCopy();
        migrated.remove("schedule");
        migrated.remove("scheduleItems");
        var directions = migrated.putArray("directions");
        catalog.directions().forEach(direction -> directions.addObject().put("id", direction.id()).put("name", direction.name()));
        var groups = migrated.putArray("groups");
        for (var group : catalog.groups()) {
            var matching = originalGroup(content, group.id());
            if (matching != null) {
                groups.add(matching);
                continue;
            }
            var row = groups.addObject().put("id", group.id()).put("directionId", group.directionId()).put("name", group.name());
            if (group.review() != null) {
                row.putObject("review").put("source", group.review());
            }
            var meetings = row.putArray("meetings");
            group.meetings().forEach(meetings::add);
            row.put("description", group.description()).put("enrollmentOpen", group.open()).put("applicationQuestion", group.question());
        }
        return stored(migrated);
    }

    private static JsonNode originalGroup(JsonNode content, String id) {
        for (var group : content.path("groups")) {
            if (id.equals(group.path("id").asString())) {
                return group;
            }
        }
        return null;
    }

    private static void validateResponses(ObjectNode content) {
        var labels = new HashSet<String>();
        for (var section : content.path("customSections")) {
            labels.add(ClientCatalog.normalizeLabel(section.path("label").asString()));
        }
        for (var keyword : content.path("keywords")) {
            require(!labels.contains(ClientCatalog.normalizeLabel(keyword.path("phrase").asString())));
        }
        // Use the same messages as the live client menu for the rendered length limit.
        var catalog = new ClientCatalog(content, Set.of());
        for (var label : new String[]{"Адрес", "Цены", "Частые вопросы"}) {
            require(catalog.sectionText(label).orElse("").length() <= 4000);
        }
    }

    static final class LegacyScheduleEdit extends RuntimeException { }
}
