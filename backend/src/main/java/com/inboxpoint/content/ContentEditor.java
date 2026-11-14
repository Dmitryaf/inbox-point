package com.inboxpoint.content;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import com.inboxpoint.content.ContentSettingsFile.Document;
import com.inboxpoint.content.ContentSettingsFile.Revision;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.inboxpoint.content.ContentShape.JSON;

@Service
final class ContentEditor {
    private static final DateTimeFormatter UTC_MILLISECONDS = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    private static final JsonNode EMPTY_LIST = JSON.createArrayNode();
    private final ContentSettingsFile settings;

    ContentEditor(Environment environment) {
        var database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
        settings = new ContentSettingsFile(database.resolveSibling("content-settings.json"));
    }

    synchronized Snapshot current() {
        try {
            return snapshot(settings.read().content());
        } catch (IOException invalid) {
            return snapshot(JSON.createObjectNode());
        }
    }

    synchronized List<Change> history() throws IOException {
        return settings.read().history().stream().map(entry -> new Change(entry.changedAt(), entry.number(), entry.sections())).toList();
    }

    synchronized Optional<Snapshot> revision(long revision) throws IOException {
        return find(settings.read(), revision).map(entry -> snapshot(entry.content()));
    }

    synchronized Snapshot save(JsonNode input, String version) throws IOException {
        var current = settings.read();
        var next = ContentFields.submitted(input, current.content());
        assertVersion(current, version);
        ContentFields.assignSectionIds(next, current.content(), false);
        return commit(current, next);
    }

    synchronized Snapshot restore(long revision, String version) throws IOException {
        var current = settings.read();
        assertVersion(current, version);
        var target = find(current, revision).orElseThrow(RevisionUnavailable::new).content().deepCopy();
        if (target.has("keywords")) {
            var keywords = (ArrayNode) target.path("keywords");
            keywords.removeIf(keyword -> !"group".equals(keyword.path("targetType").asString()));
        }
        return commit(current, target);
    }

    private Snapshot commit(Document current, ObjectNode next) throws IOException {
        var sections = changedSections(current.content(), next);
        if (sections.isEmpty()) {
            return snapshot(current.content());
        }
        var number = current.history().stream().mapToLong(Revision::number).max().orElse(0) + 1;
        if (number >= (1L << 53)) {
            throw new IOException("Content revision number is out of range");
        }
        var history = new ArrayList<Revision>();
        history.add(new Revision(number, UTC_MILLISECONDS.format(Instant.now()), sections, next));
        history.addAll(current.history().subList(0, Math.min(19, current.history().size())));
        settings.save(new Document(next, List.copyOf(history), null));
        return snapshot(next);
    }

    private static Optional<Revision> find(Document current, long number) {
        return current.history().stream().filter(entry -> entry.number() == number).findFirst();
    }

    private static Snapshot snapshot(ObjectNode content) {
        var output = content.deepCopy().put("schedule", "");
        output.putArray("scheduleItems");
        return new Snapshot(output, ContentSettingsFile.hash(content.toString()));
    }

    private static void assertVersion(Document current, String version) {
        if (!ContentSettingsFile.hash(current.content().toString()).equals(version)) {
            throw new VersionConflict();
        }
    }

    private static List<String> changedSections(ObjectNode before, ObjectNode after) {
        var changed = new ArrayList<String>();
        if (!Objects.equals(before.get("organizationName"), after.get("organizationName"))) {
            changed.add("organization");
        }
        if (ContentClasses.FIELDS.stream().anyMatch(key -> different(before, after, key, EMPTY_LIST))) {
            changed.add("schedule");
        }
        for (var text : new String[]{"prices", "address"}) {
            if (!Objects.equals(before.get(text), after.get(text))) {
                changed.add(text);
            }
        }
        for (var list : new String[]{"faq", "customSections"}) {
            if (different(before, after, list, EMPTY_LIST)) {
                changed.add(list);
            }
        }
        if (different(before, after, "visibleSections", ContentFields.DEFAULT_VISIBILITY)) {
            changed.add("visibility");
        }
        return List.copyOf(changed);
    }

    private static boolean different(ObjectNode before, ObjectNode after, String field, JsonNode fallback) {
        var initial = before.has(field) ? before.path(field) : fallback;
        var next = after.has(field) ? after.path(field) : fallback;
        return !initial.equals(next);
    }

    record Snapshot(ObjectNode content, String version) { }

    record Change(String changedAt, long revision, List<String> sections) { }

    static final class VersionConflict extends RuntimeException { }

    static final class RevisionUnavailable extends RuntimeException { }
}
