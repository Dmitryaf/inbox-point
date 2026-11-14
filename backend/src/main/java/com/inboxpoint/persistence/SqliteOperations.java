package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Repository;

@Repository
public final class SqliteOperations {
    private static final String OPERATOR_INCIDENTS = """
            WHERE action.status = 'outcome_unknown' OR (action.kind = 'reopen_request'
                AND (action.status = 'failed' OR (action.status = 'abandoned'
                    AND action.manual_resolution = 'confirmed_not_completed'))
                AND EXISTS (SELECT 1 FROM conversation_messages AS held
                    WHERE held.prerequisite_action_id = action.id AND held.processing_state = 'held'))
            """;
    private final Path database;

    public SqliteOperations(Environment environment) {
        database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
    }

    public SqliteTextHandoff openHandoff() throws SQLException {
        return SqliteTextHandoff.openExisting(database);
    }

    public Map<String, Long> usageCounts(Instant since) throws SQLException {
        var counts = new LinkedHashMap<String, Long>();
        for (var event : List.of("new_request", "information_section", "menu_action", "first_reply", "delivery_failure", "web_takeover")) {
            counts.put(event, 0L);
        }
        try (var connection = SqliteDatabase.openExisting(database, true);
                var statement = connection.prepareStatement("""
                        SELECT event_type, COUNT(*) FROM usage_events WHERE occurred_at >= ? GROUP BY event_type
                        """)) {
            statement.setString(1, SqliteDatabase.timestamp(since));
            try (var rows = statement.executeQuery()) {
                while (rows.next()) {
                    counts.put(rows.getString(1), rows.getLong(2));
                }
            }
        }
        return counts;
    }

    public Snapshot snapshot() throws SQLException {
        try (var connection = SqliteDatabase.openExisting(database, true); var statement = connection.createStatement()) {
            connection.setAutoCommit(false);
            DeliveryCounts deliveries;
            try (var rows = statement.executeQuery("""
                    SELECT SUM(status = 'failed'), SUM(status = 'pending'), SUM(outcome_unknown = 1),
                        MIN(CASE WHEN status = 'pending' THEN created_at END) FROM deliveries
                    """)) {
                rows.next();
                deliveries = new DeliveryCounts(rows.getLong(1), rows.getLong(2), rows.getLong(3), rows.getString(4));
            }
            Counts counts;
            try (var rows = statement.executeQuery("""
                    SELECT
                        (SELECT COUNT(*) FROM inbound_events WHERE status = 'quarantined'),
                        (SELECT COUNT(*) FROM operator_actions WHERE status = 'outcome_unknown'),
                        (SELECT COUNT(*) FROM support_requests WHERE status = 'active'
                            AND operator_topic_id GLOB 'web:*' AND web_owned_at IS NULL),
                        (SELECT COUNT(*) FROM support_requests WHERE status = 'active'
                            AND operator_topic_id GLOB 'web:*' AND web_owned_at IS NOT NULL)
                    """)) {
                rows.next();
                counts = new Counts(rows.getLong(1), rows.getLong(2), rows.getLong(3), rows.getLong(4));
            }
            var result = new Snapshot(deliveries, counts, deliveryIncidents(connection), operatorIncidents(connection), inboundIncidents(connection));
            connection.commit();
            return result;
        }
    }

    private static List<Map<String, Object>> deliveryIncidents(Connection connection) throws SQLException {
        var incidents = new ArrayList<Map<String, Object>>();
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                SELECT delivery.*, request.client_display_name, request.operator_topic_id FROM deliveries AS delivery
                JOIN support_requests AS request ON request.id = delivery.request_id
                WHERE delivery.status = 'failed' ORDER BY delivery.created_at DESC, delivery.id DESC LIMIT 20
                """)) {
            while (rows.next()) {
                var incident = requestIncident(rows);
                putText(incident, "operatorMessageId", rows.getString("operator_message_id"));
                incident.put("messageText", rows.getString("text"));
                incident.put("attempts", rows.getInt("attempts"));
                var uncertain = rows.getBoolean("outcome_unknown");
                incident.put("outcomeUnknown", uncertain);
                incident.put("retryAllowed", !uncertain);
                incident.put("reason", deliveryReason(rows, uncertain));
                incidents.add(incident);
            }
        }
        return incidents;
    }

    private static List<Map<String, Object>> operatorIncidents(Connection connection) throws SQLException {
        var incidents = new ArrayList<Map<String, Object>>();
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                SELECT action.*, request.channel, request.client_display_name, message.text AS message_text,
                    (SELECT COUNT(*) FROM conversation_messages AS held
                        WHERE held.prerequisite_action_id = action.id AND held.processing_state = 'held') AS held_count,
                    CASE WHEN action.kind IN ('close_request', 'reopen_request') THEN 1
                        WHEN action.kind IN ('relay_message', 'mirror_operator_message') AND NOT EXISTS (
                            SELECT 1 FROM operator_actions AS blocking WHERE blocking.id != action.id
                                AND blocking.request_id = action.request_id AND blocking.client_message_id = action.client_message_id
                                AND blocking.status IN ('pending', 'sending', 'failed')) THEN 1 ELSE 0 END AS confirmable
                FROM operator_actions AS action JOIN support_requests AS request ON request.id = action.request_id
                LEFT JOIN conversation_messages AS message ON message.request_id = action.request_id
                    AND message.external_message_id = action.client_message_id AND message.processing_state = 'accepted'
                    AND ((action.kind IN ('relay_message', 'open_request') AND message.direction = 'client_to_operator')
                        OR (action.kind = 'mirror_operator_message' AND message.direction = 'operator_to_client'))
                """ + OPERATOR_INCIDENTS + " ORDER BY action.created_at DESC, action.id DESC LIMIT 20")) {
            while (rows.next()) {
                var incident = requestIncident(rows);
                var kind = rows.getString("kind");
                var status = rows.getString("status");
                var held = rows.getInt("held_count");
                incident.put("action", kind);
                incident.put("status", status);
                incident.put("heldReplyCount", held);
                incident.put("initial", rows.getBoolean("initial"));
                incident.put("confirmable", rows.getBoolean("confirmable"));
                incident.put("sequence", rows.getInt("sequence"));
                incident.put("clientMessageId", rows.getString("client_message_id"));
                putText(incident, "messageText", rows.getString("message_text"));
                incident.put("reason", operatorReason(kind, status, held));
                incidents.add(incident);
            }
        }
        return incidents;
    }

    private static List<Map<String, Object>> inboundIncidents(Connection connection) throws SQLException {
        var incidents = new ArrayList<Map<String, Object>>();
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                SELECT source, external_event_id, received_at, attempts FROM inbound_events
                WHERE status = 'quarantined' ORDER BY received_at, rowid LIMIT 20
                """)) {
            while (rows.next()) {
                var source = rows.getString("source");
                incidents.add(Map.of("source", source, "channel", channelName(source.split(":", 2)[0]),
                        "eventId", rows.getString("external_event_id"), "receivedAt", rows.getString("received_at"),
                        "attempts", rows.getInt("attempts"), "reason", "Не удалось обработать входящее событие."));
            }
        }
        return incidents;
    }

    private static Map<String, Object> requestIncident(ResultSet row) throws SQLException {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", row.getString("id"));
        result.put("requestId", row.getString("request_id"));
        result.put("channel", channelName(row.getString("channel")));
        result.put("createdAt", row.getString("created_at"));
        result.put("operatorTopicId", row.getString("operator_topic_id"));
        putText(result, "displayName", row.getString("client_display_name"));
        return result;
    }

    private static void putText(Map<String, Object> result, String key, String value) {
        if (value != null && !value.isEmpty()) {
            result.put(key, value);
        }
    }

    private static String channelName(String channel) {
        return "telegram".equals(channel) ? "Telegram" : "VK";
    }

    private static String deliveryReason(ResultSet row, boolean uncertain) throws SQLException {
        if (uncertain) {
            return "Канал мог принять ответ, но подтверждение не получено. Автоматический повтор отключён, чтобы не отправить дубликат.";
        }
        var channel = channelName(row.getString("channel"));
        var raw = row.getString("last_error");
        var message = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (List.of("blocked", "chat not found", "user is deactivated", "forbidden").stream().anyMatch(message::contains)) {
            return "Бот не может отправить ответ. Возможно, пользователь заблокировал бота.";
        }
        if (message.contains("unauthorized") || message.contains("invalid token")) {
            return "Telegram".equals(channel) ? "Telegram не принимает подключение бота. Переподключите Telegram."
                    : "VK не принимает ключ сообщества. Переподключите VK.";
        }
        if (message.contains("too many requests") || message.contains("429")) {
            return "Канал временно ограничил отправку. Повторите попытку позже.";
        }
        if (List.of("request failed", "network", "timeout", "econn").stream().anyMatch(message::contains)) {
            return "Не удалось связаться с каналом. Проверьте интернет и повторите попытку.";
        }
        return channel + " не доставил ответ. Проверьте подключение и повторите попытку.";
    }

    private static String operatorReason(String kind, String status, int held) {
        return switch (kind) {
            case "close_request" -> "Telegram мог закрыть тему, но подтверждение не получено. Обращение пока оставлено открытым в Inbox Point.";
            case "reopen_request" -> held > 0
                    ? "Не удалось подтвердить открытие Telegram-темы. Ответ администратора сохранён."
                    : "Telegram мог открыть тему, но подтверждение не получено. Обращение пока оставлено закрытым в Inbox Point.";
            case "open_request" -> "Telegram мог создать тему, но подтверждение не получено. Обращение сохранено в web inbox. Проверьте группу и закройте возможный дубль.";
            case "mirror_operator_message" -> "Telegram мог отразить ответ, отправленный из VK. Проверьте тему перед повторной отправкой.";
            default -> "Telegram мог принять сообщение клиента. Проверьте тему или переведите обращение в web inbox.";
        };
    }

    public record DeliveryCounts(long failed, long pending, long uncertain, String oldestPendingAt) { }
    public record Counts(long quarantined, long uncertain, long recoverable, long webOwned) { }
    public record Snapshot(DeliveryCounts deliveries, Counts counts, List<Map<String, Object>> deliveryIncidents,
            List<Map<String, Object>> operatorIncidents, List<Map<String, Object>> inboundIncidents) { }
}
