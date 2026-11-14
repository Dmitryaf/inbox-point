package com.inboxpoint.content;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

import com.inboxpoint.persistence.LocalJsonFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import static com.inboxpoint.content.ContentShape.JSON;
import static com.inboxpoint.content.ContentShape.array;
import static com.inboxpoint.content.ContentShape.object;
import static com.inboxpoint.content.ContentShape.require;
import static com.inboxpoint.content.ContentShape.text;

final class ContentSettingsFile {
    static final Set<String> SECTIONS = Set.of("organization", "schedule", "prices", "address", "faq", "customSections", "visibility");
    private final Path path;

    ContentSettingsFile(Path path) {
        this.path = path;
    }

    Document read() throws IOException {
        String original;
        try {
            original = Files.readString(path, StandardCharsets.UTF_8);
        } catch (NoSuchFileException absent) {
            return new Document(JSON.createObjectNode(), List.of(), null);
        }
        try {
            var stored = parse(original);
            boolean scheduleMigration = stored.content().has("schedule")
                    || stored.history().stream().anyMatch(entry -> entry.content().has("schedule"));
            var current = ContentFields.migrateSchedule(stored.content());
            var history = new ArrayList<Revision>(stored.history().size());
            for (var revision : stored.history()) {
                history.add(new Revision(revision.number(), revision.changedAt(), revision.sections(),
                        ContentFields.migrateSchedule(revision.content())));
            }

            boolean assigned = false;
            var previous = JSON.createObjectNode();
            for (var i = history.size() - 1; i >= 0; i--) {
                var content = history.get(i).content();
                assigned |= ContentFields.assignSectionIds(content, previous, true);
                previous = content;
            }
            assigned |= ContentFields.assignSectionIds(current, previous, true);
            var document = new Document(current, List.copyOf(history), stored.previousMenuActions());
            if (scheduleMigration || assigned) {
                var replacement = serialize(document);
                parse(replacement);
                if (scheduleMigration) {
                    verifyBackup(original);
                }
                LocalJsonFile.writeText(path, replacement);
                if (!replacement.equals(Files.readString(path, StandardCharsets.UTF_8))) {
                    throw new IOException("Could not verify the updated content settings");
                }
            }
            return document;
        } catch (JacksonException | ContentShape.InvalidContent | IllegalArgumentException invalid) {
            throw new IOException("The local content settings are invalid");
        }
    }

    void save(Document document) throws IOException {
        LocalJsonFile.writeText(path, serialize(document));
    }

    private void verifyBackup(String original) throws IOException {
        var backup = path.resolveSibling(path.getFileName() + ".before-classes-" + hash(original) + ".json");
        try {
            if (!original.equals(Files.readString(backup, StandardCharsets.UTF_8))) {
                throw new IOException("The schedule migration backup does not match the source");
            }
        } catch (NoSuchFileException absent) {
            LocalJsonFile.writeText(backup, original);
            if (!original.equals(Files.readString(backup, StandardCharsets.UTF_8))) {
                throw new IOException("The schedule migration backup could not be verified");
            }
        }
    }

    private static Document parse(String document) {
        var root = JSON.readTree(document);
        object(root, true, "formatVersion", "content", "history", "previousMenuActions");
        if (root.has("formatVersion")) {
            var version = positiveNumber(root.path("formatVersion"));
            require(version == 2 || version == 3);
        }
        var history = new ArrayList<Revision>();
        for (var item : array(root.path("history"), 20)) {
            object(item, false);
            var number = positiveNumber(item.path("revision"));
            var changedAt = text(item.path("changedAt"), 1, 120, false);
            validateDate(changedAt);
            var sections = new ArrayList<String>();
            for (var section : array(item.path("sections"), 7)) {
                var key = text(section, 1, 20, false);
                require(SECTIONS.contains(key));
                sections.add(key);
            }
            require(!sections.isEmpty());
            history.add(new Revision(number, changedAt, List.copyOf(sections), ContentFields.stored(item.path("content"))));
        }

        ArrayNode previous = null;
        if (root.has("previousMenuActions")) {
            previous = JSON.createArrayNode();
            var labels = new HashSet<String>();
            for (var entry : array(root.path("previousMenuActions"), 10)) {
                var label = text(entry, 1, 40, true);
                require(labels.add(label));
                previous.add(label);
            }
        }
        return new Document(ContentFields.stored(root.path("content")), List.copyOf(history), previous);
    }

    private static void validateDate(String value) {
        try {
            DateTimeFormatter.ISO_DATE_TIME.parse(value);
        } catch (DateTimeParseException notDateTime) {
            try {
                DateTimeFormatter.ISO_DATE.parse(value);
            } catch (DateTimeParseException invalid) {
                throw new ContentShape.InvalidContent();
            }
        }
    }

    private static String serialize(Document document) {
        var output = JSON.createObjectNode();
        if (hasClasses(document.content()) || document.history().stream().anyMatch(entry -> hasClasses(entry.content()))) {
            output.put("formatVersion", 3);
        }
        if (document.previousMenuActions() != null) {
            output.set("previousMenuActions", document.previousMenuActions());
        }
        output.set("content", document.content());
        var history = output.putArray("history");
        for (var entry : document.history()) {
            var row = history.addObject().put("changedAt", entry.changedAt());
            var sections = row.putArray("sections");
            entry.sections().forEach(sections::add);
            row.set("content", entry.content());
            row.put("revision", entry.number());
        }
        return output.toPrettyString() + "\n";
    }

    private static boolean hasClasses(ObjectNode content) {
        return ContentClasses.FIELDS.stream().anyMatch(property -> content.path(property).size() > 0);
    }

    static long positiveNumber(JsonNode node) {
        require(node.isIntegralNumber() && node.canConvertToLong() && node.longValue() > 0 && node.longValue() < (1L << 53));
        return node.longValue();
    }

    static String hash(String input) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    record Document(ObjectNode content, List<Revision> history, ArrayNode previousMenuActions) { }

    record Revision(long number, String changedAt, List<String> sections, ObjectNode content) { }
}
