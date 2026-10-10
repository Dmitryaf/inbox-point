package com.inboxpoint.content;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.inboxpoint.content.ClientCatalog.Direction;
import com.inboxpoint.content.ClientCatalog.Group;
import com.inboxpoint.content.ClientCatalog.ScheduleEntry;

final class LegacySchedule {
    private record Names(String direction, String group) { }

    record Classes(List<Direction> directions, List<Group> groups) { }

    private static final Map<String, Names> KNOWN = Map.of(
            "Бачата парная (начинающие)", new Names("Бачата парная", "Начинающие"),
            "Бачата парная (продолжающая)", new Names("Бачата парная", "Продолжающие"),
            "Сальса парная (начинающая)", new Names("Сальса парная", "Начинающие"),
            "Сальса парная (продолжающие)", new Names("Сальса парная", "Продолжающие"));

    private final List<Direction> directions;
    private final List<Group> groups;
    private final Set<String> originalGroupIds;
    private final Set<String> ids = new HashSet<>();

    private LegacySchedule(List<Direction> directions, List<Group> groups) {
        this.directions = new ArrayList<>(directions);
        this.groups = new ArrayList<>(groups);
        this.originalGroupIds = new HashSet<>();
        for (var group : groups) {
            ids.add(group.id());
            originalGroupIds.add(group.id());
        }
        for (var direction : directions) {
            ids.add(direction.id());
        }
    }

    static Classes migrate(List<Direction> directions, List<Group> groups, List<ScheduleEntry> entries, String raw) {
        if (entries.isEmpty() && raw.isEmpty()) {
            return new Classes(directions, groups);
        }
        var migration = new LegacySchedule(directions, groups);
        for (var index = 0; index < entries.size(); index++) {
            migration.importEntry(entries.get(index), index);
        }
        if (!raw.isEmpty()) {
            migration.keepForReview(raw, -1);
        }
        return new Classes(List.copyOf(migration.directions), List.copyOf(migration.groups));
    }

    private void importEntry(ScheduleEntry entry, int index) {
        var source = entry.title() + "\n" + entry.time()
                + (entry.description().isEmpty() ? "" : "\n" + entry.description());
        var names = KNOWN.get(entry.title());
        if (names == null || entry.time().isBlank()) {
            keepForReview(source, index);
            return;
        }
        var direction = direction(names.direction());
        if (direction == null) {
            keepForReview(source, index);
            return;
        }
        var normalizedName = ClientCatalog.normalizeLabel(names.group());
        for (int i = 0; i < groups.size(); i++) {
            var existing = groups.get(i);
            if (existing.review() != null || !existing.directionId().equals(direction.id())
                    || !ClientCatalog.normalizeLabel(existing.name()).equals(normalizedName)) {
                continue;
            }
            mergeExisting(entry, index, source, i, existing);
            return;
        }
        if (groups.stream().filter(group -> group.review() == null).count() >= 60) {
            keepForReview(source, index);
            return;
        }
        groups.add(new Group(allocate("group:" + names.direction() + ":" + names.group()), direction.id(),
                names.group(), List.of(entry.time()), entry.description(), false, "", "", null));
    }

    private Direction direction(String name) {
        var normalized = ClientCatalog.normalizeLabel(name);
        var existing = directions.stream().filter(item -> ClientCatalog.normalizeLabel(item.name()).equals(normalized))
                .findFirst();
        if (existing.isPresent()) {
            return existing.get();
        }
        if (directions.size() >= 20) {
            return null;
        }
        var direction = new Direction(allocate("direction:" + name), name);
        directions.add(direction);
        return direction;
    }

    private void mergeExisting(ScheduleEntry entry, int index, String source, int position, Group existing) {
        var sameDescription = existing.description().equals(entry.description());
        if (sameDescription && existing.meetings().contains(entry.time())) {
            return;
        }
        if (!originalGroupIds.contains(existing.id()) && sameDescription && existing.meetings().size() < 7) {
            var meetings = new ArrayList<>(existing.meetings());
            meetings.add(entry.time());
            groups.set(position, new Group(existing.id(), existing.directionId(), existing.name(),
                    List.copyOf(meetings), existing.description(), false, "", "", null));
        } else {
            keepForReview(source, index);
        }
    }

    private void keepForReview(String source, int index) {
        groups.add(new Group(allocate("review:" + index + ":" + source), "", "", List.of(),
                "", false, "", "", source));
    }

    private String allocate(String seed) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            var attempt = 0;
            String id;
            do {
                var bytes = digest.digest((seed + ":" + attempt++).getBytes(StandardCharsets.UTF_8));
                id = "import-" + HexFormat.of().formatHex(bytes, 0, 14);
            } while (!ids.add(id));
            return id;
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException("SHA-256 is unavailable", failure);
        }
    }
}
