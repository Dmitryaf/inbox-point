package com.inboxpoint.persistence;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import tools.jackson.databind.json.JsonMapper;

public final class BrowserData {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final List<String> REQUESTS = List.of("request-a", "request-b");
    private final Path database;
    private final String mode;

    public BrowserData(Path database, String mode) throws SQLException {
        this.database = database;
        this.mode = mode;
        var now = Instant.now();
        try (var sql = SqliteDatabase.openOrMigrate(database)) {
            SqliteDatabase.writeTransaction(sql, () -> {
                if (mode.equals("operations")) {
                    seedOperations(sql, SqliteDatabase.timestamp(now));
                } else if (mode.equals("setup")) {
                    seedSetup(sql, SqliteDatabase.timestamp(now));
                } else {
                    seedAnalytics(sql, now);
                }
            });
        }
    }

    public Map<String, Object> state() throws SQLException {
        try (var sql = SqliteDatabase.openExisting(database)) {
            if (mode.equals("setup")) {
                return Map.of(
                        "telegramSaved", Files.exists(database.resolveSibling("telegram-settings.json")),
                        "vkSaved", Files.exists(database.resolveSibling("vk-settings.json")),
                        "request", rows(sql, "SELECT * FROM support_requests WHERE id = 'synthetic-request'").getFirst(),
                        "messages", rows(sql, "SELECT * FROM conversation_messages WHERE request_id = 'synthetic-request' ORDER BY id"));
            }
            var state = new LinkedHashMap<String, Object>();
            state.put("ids", REQUESTS);
            state.put("requests", rows(sql, """
                    SELECT id, status, operator_topic_id AS operatorTopicId
                      FROM support_requests WHERE id IN ('request-a', 'request-b') ORDER BY id
                    """));
            state.put("pending", rows(sql, """
                    SELECT id, request_id AS requestId, external_conversation_id AS conversationId,
                           text, idempotency_key AS idempotencyKey
                      FROM deliveries WHERE status = 'pending' ORDER BY rowid
                    """));
            state.put("failed", rows(sql, """
                    SELECT id, outcome_unknown AS outcomeUnknown
                      FROM deliveries WHERE status = 'failed' AND manual_resolution IS NULL ORDER BY rowid
                    """));
            var control = database.resolveSibling("service-control.json");
            if (Files.exists(control)) {
                state.put("control", JSON.readTree(control.toFile()));
            }
            return state;
        }
    }

    public boolean recover(String id) throws SQLException {
        try (var sql = SqliteDatabase.openExisting(database)) {
            return update(sql, """
                    UPDATE support_requests SET operator_topic_id = 'topic-recovered', web_owned_at = NULL
                     WHERE id = ? AND operator_topic_id = ? AND status = 'active'
                    """, id, "web:" + id) == 1;
        }
    }

    private static void seedAnalytics(Connection sql, Instant now) throws SQLException {
        for (int i = 0; i < 14; i++) {
            update(sql, "INSERT INTO usage_events (id, channel, event_type, occurred_at) VALUES (?, ?, 'new_request', ?)",
                    "request:" + i, i < 8 ? "telegram" : "vk", SqliteDatabase.timestamp(now.minus(i % 7, ChronoUnit.DAYS)));
        }
        for (int i = 0; i < 83; i++) {
            var action = i < 50 ? "prices" : i < 70 ? "custom:synthetic-id" : "handoff";
            var label = i < 50 ? "Цены" : i < 70 ? "Записаться на первое пробное занятие" : "Задать вопрос";
            update(sql, """
                    INSERT INTO usage_events (id, channel, event_type, action_key, action_label, occurred_at)
                    VALUES (?, ?, 'menu_action', ?, ?, ?)
                    """, "menu:" + i, i < 52 ? "telegram" : "vk", action, label,
                    SqliteDatabase.timestamp(now.minus(i % 7, ChronoUnit.DAYS)));
        }
    }

    private static void seedSetup(Connection sql, String now) throws SQLException {
        request(sql, "synthetic-request", "synthetic-client", null, "synthetic-topic", now);
        message(sql, "synthetic-message", "synthetic-request", "external-synthetic", null,
                "client_to_operator", "Синтетический вопрос для проверки сохранности истории", now);
        update(sql, "INSERT INTO channel_connection_identities VALUES ('telegram', '501:-1001'), ('vk', '12345')");
    }

    private static void seedOperations(Connection sql, String now) throws SQLException {
        for (int i = 0; i < REQUESTS.size(); i++) {
            var id = REQUESTS.get(i);
            var label = i == 0 ? "A" : "B";
            request(sql, id, i == 0 ? "101" : "202",
                    "Клиент " + label + " с длинным именем для проверки переписки", "web:" + id, now);
            message(sql, "message-" + label, id, "external-" + label, null, "client_to_operator",
                    "Message " + label + ". Синтетический вопрос о первом занятии и расписании.", now);
        }
        for (int i = 0; i < 20; i++) {
            message(sql, "history-" + i, REQUESTS.getFirst(), "external-history-" + i, "Синтетический клиент A",
                    "client_to_operator", "Запись " + (i + 1)
                            + ": подробный синтетический вопрос о расписании и пробном занятии для проверки прокрутки переписки.", now);
        }
        request(sql, "incident-request", "303", "Синтетический клиент для проверки инцидентов", "topic-303", now);
        for (var kind : List.of("failed", "unknown")) {
            var text = "Синтетический ответ " + kind + ": подробная информация о записи и времени первого занятия.";
            message(sql, "message-" + kind, "incident-request", "operator-" + kind, null,
                    "operator_to_client", text, now);
            update(sql, """
                    INSERT INTO deliveries
                    (id, idempotency_key, request_id, operator_message_id, channel, external_conversation_id,
                     created_at, text, status, last_error, outcome_unknown)
                    VALUES (?, ?, 'incident-request', ?, 'vk', '303', ?, ?, 'failed', 'network timeout', ?)
                    """, "delivery-" + kind, "seed-" + kind, "operator-" + kind, now, text, kind.equals("unknown") ? 1 : 0);
        }
        update(sql, """
                INSERT INTO operator_actions
                (id, kind, request_id, operator_topic_id, client_message_id, created_at, initial, sequence, status, last_error)
                VALUES ('operator:close', 'close_request', 'incident-request', 'topic-303', 'external-close',
                        ?, 0, 0, 'outcome_unknown', 'synthetic timeout')
                """, now);
        update(sql, """
                INSERT INTO inbound_events (source, external_event_id, payload, received_at, status, last_error, attempts)
                VALUES ('telegram:get-updates', 'event:1', '{}', ?, 'quarantined', 'synthetic failure', 1)
                """, now);
    }

    private static void request(Connection sql, String id, String conversation, String name, String topic, String now)
            throws SQLException {
        update(sql, """
                INSERT INTO support_requests
                (id, channel, external_conversation_id, client_display_name, operator_topic_id, web_owned_at, status, created_at)
                VALUES (?, 'vk', ?, ?, ?, ?, 'active', ?)
                """, id, conversation, name, topic, topic.startsWith("web:") ? now : null, now);
    }

    private static void message(Connection sql, String id, String request, String externalId, String sender,
            String direction, String text, String now) throws SQLException {
        update(sql, """
                INSERT INTO conversation_messages (id, request_id, external_message_id, sender_name, direction, text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, request, externalId, sender, direction, text, now);
    }

    private static int update(Connection sql, String query, Object... values) throws SQLException {
        try (var statement = sql.prepareStatement(query)) {
            for (int i = 0; i < values.length; i++) {
                statement.setObject(i + 1, values[i]);
            }
            return statement.executeUpdate();
        }
    }

    private static List<Map<String, Object>> rows(Connection sql, String query) throws SQLException {
        var result = new ArrayList<Map<String, Object>>();
        try (var statement = sql.createStatement(); var cursor = statement.executeQuery(query)) {
            var columns = cursor.getMetaData();
            while (cursor.next()) {
                var row = new LinkedHashMap<String, Object>();
                for (int i = 1; i <= columns.getColumnCount(); i++) {
                    row.put(columns.getColumnLabel(i), cursor.getObject(i));
                }
                result.add(row);
            }
        }
        return result;
    }
}
