package com.inboxpoint.content;

import java.util.Set;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;

final class ContentShape {
    static final JsonMapper JSON = JsonMapper.shared();
    static final Set<String> RESERVED_LABELS = Set.of("Расписание", "Цены", "Адрес", "Частые вопросы",
            "Задать вопрос", "Начать новый вопрос", "/start", "/menu", "Начать", "Меню");
    private static final Pattern EDGES = Pattern.compile("(?U)^[\\s\\uFEFF]+|[\\s\\uFEFF]+$");

    private ContentShape() { }

    static String trim(String value) {
        return EDGES.matcher(value).replaceAll("");
    }

    static void object(JsonNode node, boolean strict, String... fields) {
        require(node != null && node.isObject() && (!strict || Set.of(fields).containsAll(node.propertyNames())));
    }

    static ArrayNode array(JsonNode node, int limit) {
        require(node instanceof ArrayNode && node.size() <= limit);
        return (ArrayNode) node;
    }

    static String text(JsonNode node, int min, int max, boolean strip) {
        require(node != null && node.isString());
        var value = strip ? trim(node.asString()) : node.asString();
        require(value.length() >= min && value.length() <= max);
        return value;
    }

    static void singleLine(String value) {
        require(value.indexOf('\n') < 0 && value.indexOf('\r') < 0);
    }

    static void require(boolean condition) {
        if (!condition) {
            throw new InvalidContent();
        }
    }

    static final class InvalidContent extends IllegalArgumentException {
        InvalidContent() {
            super("The content does not match the editor contract");
        }
    }
}
