package com.inboxpoint.content;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

import tools.jackson.databind.JsonNode;

final class ScheduleInformation {
    static final int MESSAGE_LIMIT = 4000;

    private ScheduleInformation() { }

    static List<Map<String, String>> parse(JsonNode input) {
        if (input.isMissingNode()) {
            return List.of();
        }
        if (!input.isArray() || input.size() > 20) {
            throw new IllegalArgumentException("Invalid schedule entries");
        }
        var items = new ArrayList<Map<String, String>>();
        for (var row : input) {
            if (!row.isObject() || row.size() != (row.has("description") ? 3 : 2)) {
                throw new IllegalArgumentException("Invalid schedule entry");
            }
            var title = text(row.path("title"), 120, true);
            var day = text(row.path("dayTime"), 120, true);
            var description = row.has("description") ? text(row.path("description"), 1000, false) : "";
            if (title.isEmpty() && day.isEmpty() && description.isEmpty()) {
                continue;
            }
            if (title.isEmpty() || day.isEmpty()) {
                throw new IllegalArgumentException("Each schedule entry requires a title and a day or time");
            }
            var item = new TreeMap<String, String>();
            item.put("dayTime", day);
            if (!description.isEmpty()) {
                item.put("description", description);
            }
            item.put("title", title);
            items.add(java.util.Collections.unmodifiableMap(item));
        }
        if ((!items.isEmpty() && response(items).length() > MESSAGE_LIMIT) || compatibility(items).length() > MESSAGE_LIMIT) {
            throw new IllegalArgumentException("Formatted schedule is too long");
        }
        return List.copyOf(items);
    }

    private static String text(JsonNode value, int limit, boolean oneLine) {
        if (!value.isString() || value.asString().length() > limit
                || oneLine && (value.asString().contains("\r") || value.asString().contains("\n"))) {
            throw new IllegalArgumentException("Schedule entry field is invalid");
        }
        return value.asString().strip();
    }

    static String response(List<Map<String, String>> items) {
        return "Расписание\n\n" + items.stream()
                .map(item -> item.get("title") + "\nДень / время: " + item.get("dayTime") + description(item, "\n", false))
                .collect(Collectors.joining("\n\n"));
    }

    static String compatibility(List<Map<String, String>> items) {
        return items.stream().map(item -> item.get("title") + " — " + item.get("dayTime") + description(item, " — ", true))
                .collect(Collectors.joining("\n"));
    }

    private static String description(Map<String, String> item, String prefix, boolean flattenLines) {
        var text = item.get("description");
        return text == null ? "" : prefix + (flattenLines ? text.replaceAll("\\r?\\n", " ") : text);
    }
}
