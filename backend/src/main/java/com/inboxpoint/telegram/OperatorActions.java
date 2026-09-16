package com.inboxpoint.telegram;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

final class OperatorActions {
    private static final String CONFIRMABLE = """
            action.kind = 'relay_message' AND NOT EXISTS (
                SELECT 1 FROM operator_actions AS blocking
                WHERE blocking.request_id = action.request_id AND blocking.client_message_id = action.client_message_id
                    AND blocking.id != action.id AND blocking.status IN ('pending', 'sending', 'failed')
            )
            """;
    private final Connection connection;

    OperatorActions(Connection connection) {
        this.connection = connection;
    }

    record Key(String id, String request, String kind, String topic, String message, int sequence, boolean initial) { }

    record Attempt(String status, String result, boolean initial) { }

    Attempt prepare(Key key, Instant now) throws SQLException {
        update("""
                INSERT OR IGNORE INTO operator_actions
                    (id, request_id, kind, operator_topic_id, client_message_id, sequence, initial, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """, key.id(), key.request(), key.kind(), key.topic(), key.message(), key.sequence(), key.initial(), now.toString());
        return attempt(key.id());
    }

    Attempt attempt(String id) throws SQLException {
        try (var statement = prepare("SELECT status, external_result_id, initial FROM operator_actions WHERE id = ?", id);
                var rows = statement.executeQuery()) {
            return rows.next() ? new Attempt(rows.getString(1), rows.getString(2), rows.getBoolean(3)) : null;
        }
    }

    boolean begin(String id, Instant now) throws SQLException {
        return update("""
                UPDATE operator_actions SET status = 'sending', attempt_started_at = ?,
                    manual_resolution = NULL, resolved_at = NULL
                WHERE id = ? AND (status IN ('pending', 'failed') OR
                    (status = 'abandoned' AND kind = 'reopen_request' AND manual_resolution = 'not_completed'))
                """, now.toString(), id) == 1;
    }

    void complete(String id, String result, Instant now) throws SQLException {
        if (update("""
                UPDATE operator_actions SET status = 'sent', external_result_id = ?, completed_at = ?,
                    attempt_started_at = NULL, last_error = NULL WHERE id = ? AND status = 'sending'
                """, result, now.toString(), id) != 1) {
            throw new SQLException("Claimed operator action could not be completed");
        }
    }

    void reject(String id, boolean uncertain) throws SQLException {
        update("""
                UPDATE operator_actions SET status = ?, last_error = ?, attempt_started_at = NULL
                WHERE id = ? AND status = 'sending'
                """, uncertain ? "outcome_unknown" : "failed", uncertain ? "Telegram outcome unknown" : "Telegram operation failed", id);
    }

    void recover() throws SQLException {
        update("""
                UPDATE operator_actions SET status = 'outcome_unknown', attempt_started_at = NULL,
                    last_error = 'Operator action was interrupted after it started' WHERE status = 'sending'
                """);
    }

    TelegramRuntime.OperatorRelayStatus status() throws SQLException {
        long count;
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT COUNT(*) FROM operator_actions WHERE status = 'outcome_unknown'")) {
            count = rows.next() ? rows.getLong(1) : 0;
        }
        return new TelegramRuntime.OperatorRelayStatus(count == 0 ? "healthy" : "uncertain", count,
                incidents("ORDER BY julianday(action.created_at) DESC, action.id LIMIT 20"));
    }

    TelegramRuntime.OperatorRelayIncident incident(String id) throws SQLException {
        return incidents("AND action.id = ?", id).stream().findFirst().orElse(null);
    }

    boolean confirm(String id, Instant now) throws SQLException {
        return update("""
                UPDATE operator_actions AS action SET status = 'sent', attempt_started_at = NULL,
                    completed_at = ?, resolved_at = ?, manual_resolution = 'confirmed_received', last_error = NULL
                WHERE action.id = ? AND action.status = 'outcome_unknown' AND
                """ + CONFIRMABLE, now.toString(), now.toString(), id) == 1;
    }

    boolean resolveLifecycle(String id, boolean completed, Instant now) throws SQLException {
        return update("""
                UPDATE operator_actions SET status = ?, last_error = NULL, attempt_started_at = NULL,
                    manual_resolution = ?, resolved_at = ?, completed_at = ?
                WHERE id = ? AND status = 'outcome_unknown' AND kind IN ('close_request', 'reopen_request')
                """, completed ? "sent" : "abandoned", completed ? "completed" : "not_completed", now.toString(),
                completed ? now.toString() : null, id) == 1;
    }

    void observeLifecycle(String request, String topic, boolean open, Instant now) throws SQLException {
        update("""
                UPDATE operator_actions SET status = CASE WHEN kind = ? THEN 'sent' ELSE 'abandoned' END,
                    last_error = NULL, attempt_started_at = NULL, resolved_at = ?
                WHERE request_id = ? AND operator_topic_id = ? AND kind IN ('close_request', 'reopen_request')
                    AND status = 'outcome_unknown'
                """, open ? "reopen_request" : "close_request", now.toString(), request, topic);
    }

    boolean unresolved(String request, String message) throws SQLException {
        try (var statement = prepare("""
                SELECT 1 FROM operator_actions WHERE request_id = ? AND client_message_id = ? AND status = 'outcome_unknown'
                LIMIT 1
                """, request, message); var rows = statement.executeQuery()) {
            return rows.next();
        }
    }

    void abandon(TelegramRuntime.OperatorRelayIncident incident, Instant now) throws SQLException {
        update("""
                UPDATE operator_actions SET status = 'abandoned', attempt_started_at = NULL,
                    manual_resolution = 'use_web', resolved_at = ?, last_error = NULL
                WHERE request_id = ? AND client_message_id = ? AND status IN ('outcome_unknown', 'pending', 'failed')
                """, now.toString(), incident.requestId(), incident.clientMessageId());
    }

    private List<TelegramRuntime.OperatorRelayIncident> incidents(String where, Object... args) throws SQLException {
        var sql = """
                SELECT action.id, action.kind, action.client_message_id, action.created_at, action.initial,
                    action.operator_topic_id, action.request_id, action.sequence, request.channel,
                """ + "(" + CONFIRMABLE + ") AS confirmable " + """
                FROM operator_actions action JOIN support_requests request ON request.id = action.request_id
                WHERE action.status = 'outcome_unknown'
                """ + where;
        try (var statement = prepare(sql, args); var rows = statement.executeQuery()) {
            var incidents = new ArrayList<TelegramRuntime.OperatorRelayIncident>();
            while (rows.next()) {
                var action = rows.getString("kind");
                var reason = switch (action) {
                    case "close_request" -> "Telegram мог закрыть тему, но подтверждение не получено. Обращение пока оставлено открытым в Inbox Point.";
                    case "reopen_request" -> "Telegram мог открыть тему, но подтверждение не получено. Обращение пока оставлено закрытым в Inbox Point.";
                    case "open_request" -> "Telegram мог создать тему, но подтверждение не получено. Обращение сохранено в web inbox; проверьте группу и закройте возможный дубль.";
                    default -> "Telegram мог принять сообщение клиента. Не отправляйте его повторно: проверьте тему или переведите обращение в web inbox.";
                };
                incidents.add(new TelegramRuntime.OperatorRelayIncident(rows.getString("id"), action,
                        "telegram".equals(rows.getString("channel")) ? "Telegram" : "VK",
                        rows.getString("client_message_id"), rows.getBoolean("confirmable"), rows.getString("created_at"),
                        rows.getBoolean("initial"), rows.getString("operator_topic_id"), reason,
                        rows.getString("request_id"), rows.getInt("sequence")));
            }
            return incidents;
        }
    }

    private int update(String sql, Object... args) throws SQLException {
        try (var statement = prepare(sql, args)) {
            return statement.executeUpdate();
        }
    }

    private PreparedStatement prepare(String sql, Object... args) throws SQLException {
        var statement = connection.prepareStatement(sql);
        try {
            for (int index = 0; index < args.length; index++) {
                statement.setObject(index + 1, args[index]);
            }
            return statement;
        } catch (SQLException failure) {
            statement.close();
            throw failure;
        }
    }
}
