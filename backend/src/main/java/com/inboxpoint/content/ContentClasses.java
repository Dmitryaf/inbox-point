package com.inboxpoint.content;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import static com.inboxpoint.content.ContentShape.JSON;
import static com.inboxpoint.content.ContentShape.array;
import static com.inboxpoint.content.ContentShape.object;
import static com.inboxpoint.content.ContentShape.require;
import static com.inboxpoint.content.ContentShape.singleLine;
import static com.inboxpoint.content.ContentShape.text;

final class ContentClasses {
    static final List<String> FIELDS = List.of("directions", "groups", "keywords");
    private static final Set<String> ACTION_LABELS = Set.of("Записаться на занятие", "Расписание группы",
            "Расписание всех направлений", "Другие направления", "Другие занятия", "Далее", "Назад");

    private ContentClasses() { }

    static void copy(JsonNode input, JsonNode current, ObjectNode result, boolean submitted) {
        var directionIds = new HashSet<String>();
        var directionNames = new HashSet<String>();
        var directions = value(input, current, "directions");
        if (directions != null) {
            var output = result.putArray("directions");
            for (var direction : array(directions, 20)) {
                object(direction, true, "id", "name");
                var id = identifier(direction.path("id"), false);
                var name = name(direction.path("name"), 1);
                require(directionIds.add(id) && directionNames.add(ClientCatalog.normalizeLabel(name)));
                output.addObject().put("id", id).put("name", name);
            }
        }

        var groupIds = new HashSet<String>();
        var groupNames = new HashSet<String>();
        var groups = value(input, current, "groups");
        if (groups != null) {
            var output = result.putArray("groups");
            for (var group : array(groups, 81)) {
                output.add(group(group, directionIds, groupIds, groupNames));
            }
            require(groupNames.size() <= 60);
        }

        var keywords = value(input, current, "keywords");
        if (keywords != null) {
            var output = result.putArray("keywords");
            var forbidden = new HashSet<String>();
            ContentShape.RESERVED_LABELS.forEach(label -> forbidden.add(ClientCatalog.normalizeLabel(label)));
            ACTION_LABELS.forEach(label -> forbidden.add(ClientCatalog.normalizeLabel(label)));
            for (var section : result.path("customSections")) {
                forbidden.add(ClientCatalog.normalizeLabel(section.path("label").asString("")));
            }
            var phrases = new HashSet<String>();
            for (var keyword : array(keywords, 40)) {
                object(keyword, true, "phrase", "targetType", "targetId");
                var type = text(keyword.path("targetType"), 1, 9, false);
                require(Set.of("direction", "group").contains(type));
                var id = identifier(keyword.path("targetId"), false);
                var phrase = name(keyword.path("phrase"), 1);
                var normalized = ClientCatalog.normalizeLabel(phrase);
                require(("group".equals(type) ? groupIds : directionIds).contains(id)
                        && phrases.add(normalized) && !forbidden.contains(normalized));
                output.addObject().put("phrase", phrase).put("targetType", type).put("targetId", id);
            }
        }
    }

    private static ObjectNode group(JsonNode group, Set<String> directions, Set<String> ids, Set<String> names) {
        object(group, true, "id", "directionId", "name", "review", "meetings", "description", "enrollmentOpen", "applicationQuestion");
        var id = identifier(group.path("id"), false);
        var direction = identifier(group.path("directionId"), true);
        var review = group.has("review");
        var name = name(group.path("name"), review ? 0 : 1);
        var open = group.path("enrollmentOpen");
        require(ids.add(id) && open.isBoolean());
        var output = JSON.createObjectNode().put("id", id).put("directionId", direction).put("name", name);
        if (review) {
            object(group.path("review"), true, "source");
            require(!open.booleanValue());
            output.putObject("review").put("source", text(group.at("/review/source"), 1, 6000, false));
        } else {
            require(directions.contains(direction) && names.add(direction + ":" + ClientCatalog.normalizeLabel(name)));
        }
        var meetings = output.putArray("meetings");
        for (var input : array(group.path("meetings"), 7)) {
            var meeting = text(input, 1, 120, true);
            singleLine(meeting);
            meetings.add(meeting);
        }
        require(review || !meetings.isEmpty());
        output.put("description", text(group.path("description"), 0, 1000, true))
                .put("enrollmentOpen", open.booleanValue())
                .put("applicationQuestion", text(group.path("applicationQuestion"), 0, 1000, true));
        if (group.has("confirmationText")) {
            output.put("confirmationText", text(group.path("confirmationText"), 0, 1000, true));
        }
        return output;
    }

    private static String identifier(JsonNode node, boolean emptyAllowed) {
        var id = text(node, emptyAllowed ? 0 : 1, 36, false);
        require(id.matches("[A-Za-z0-9_-]*"));
        return id;
    }

    private static String name(JsonNode node, int min) {
        var value = text(node, min, 80, true);
        singleLine(value);
        require(value.indexOf('/') < 0 && value.indexOf(':') < 0);
        return value;
    }

    private static JsonNode value(JsonNode input, JsonNode current, String property) {
        return input.has(property) ? input.get(property) : current == null ? null : current.get(property);
    }
}
