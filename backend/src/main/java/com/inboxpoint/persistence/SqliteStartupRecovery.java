package com.inboxpoint.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;

final class SqliteStartupRecovery {
    private SqliteStartupRecovery() {
    }

    static void recoverInterruptedWork(Connection connection, Instant now) throws SQLException {
        SqliteDatabase.writeTransaction(connection, () -> {
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("DELETE FROM processed_events WHERE status = 'processing'");
                statement.executeUpdate("""
                        UPDATE operator_actions
                        SET status = 'outcome_unknown',
                            last_error = 'Operator action was interrupted after the attempt started',
                            attempt_started_at = NULL
                        WHERE status = 'sending'
                        """);
                statement.executeUpdate("""
                        UPDATE operator_actions
                        SET status = 'failed',
                            last_error = 'Opening the Telegram topic was interrupted before the attempt started'
                        WHERE kind = 'reopen_request' AND status = 'pending'
                            AND EXISTS (
                                SELECT 1 FROM conversation_messages
                                WHERE prerequisite_action_id = operator_actions.id AND processing_state = 'held'
                            )
                        """);
            }
            recoverInterruptedDeliveries(connection);
            recoverConfirmedReopens(connection, now);
            recoverSupersededReplies(connection, now);
        });
    }

    static void recoverInterruptedDeliveries(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("""
                    UPDATE deliveries
                    SET status = 'failed', attempts = attempts + 1,
                        last_error = 'Delivery was interrupted after the attempt started',
                        outcome_unknown = 1, attempt_started_at = NULL
                    WHERE status = 'pending' AND attempt_started_at IS NOT NULL
                    """);
        }
    }

    private record ConfirmedReopen(String requestId, String topicId) {
    }

    private static void recoverConfirmedReopens(Connection connection, Instant now) throws SQLException {
        var reopens = new ArrayList<ConfirmedReopen>();
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("""
                        SELECT DISTINCT action.request_id, action.operator_topic_id FROM operator_actions AS action
                        JOIN conversation_messages AS held
                            ON held.prerequisite_action_id = action.id AND held.processing_state = 'held'
                        WHERE action.kind = 'reopen_request' AND action.status = 'sent'
                        """)) {
            while (rows.next()) {
                reopens.add(new ConfirmedReopen(rows.getString("request_id"), rows.getString("operator_topic_id")));
            }
        }
        for (var reopen : reopens) {
            if (!reactivateRequest(connection, reopen.requestId(), reopen.topicId())) {
                throw new SQLException("Completed held operator reply could not be recovered");
            }
            releaseHeldReplies(connection, reopen.requestId(), now);
        }
    }

    static boolean reactivateRequest(Connection connection, String requestId, String topicId) throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE support_requests AS current SET status = 'active', closed_at = NULL
                WHERE current.id = ? AND current.operator_topic_id = ?
                    AND current.id = (
                        SELECT latest.id FROM support_requests AS latest
                        WHERE latest.channel = current.channel
                            AND latest.external_conversation_id = current.external_conversation_id
                        ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
                    )
                    AND NOT EXISTS (
                        SELECT 1 FROM support_requests AS active
                        WHERE active.channel = current.channel
                            AND active.external_conversation_id = current.external_conversation_id
                            AND active.id != current.id AND active.status = 'active'
                    )
                """)) {
            statement.setString(1, requestId);
            statement.setString(2, topicId);
            if (statement.executeUpdate() != 1) {
                return false;
            }
        }
        try (var statement = connection.prepareStatement("""
                DELETE FROM client_conversation_states
                WHERE EXISTS (
                    SELECT 1 FROM support_requests AS request WHERE request.id = ?
                        AND request.channel = client_conversation_states.channel
                        AND request.external_conversation_id = client_conversation_states.external_conversation_id
                )
                """)) {
            statement.setString(1, requestId);
            statement.executeUpdate();
        }
        return true;
    }

    private static void recoverSupersededReplies(Connection connection, Instant now) throws SQLException {
        var requestIds = new ArrayList<String>();
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("""
                        SELECT DISTINCT request.id FROM operator_actions AS action
                        JOIN conversation_messages AS held
                            ON held.prerequisite_action_id = action.id AND held.processing_state = 'held'
                        JOIN support_requests AS request ON request.id = action.request_id
                        WHERE action.status = 'superseded' AND request.status = 'closed'
                        """)) {
            while (rows.next()) {
                requestIds.add(rows.getString("id"));
            }
        }
        for (var requestId : requestIds) {
            releaseHeldReplies(connection, requestId, now);
        }
    }

    static void releaseHeldReplies(Connection connection, String requestId, Instant now) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO deliveries (id, request_id, idempotency_key, operator_message_id, channel,
                                        external_conversation_id, text, status, created_at, next_attempt_at)
                SELECT 'held-delivery:' || held.id, request.id, 'operator:' || held.external_event_id,
                    held.external_message_id, request.channel, request.external_conversation_id, held.text,
                    'pending', held.created_at, held.created_at
                FROM conversation_messages AS held JOIN support_requests AS request ON request.id = held.request_id
                WHERE request.id = ? AND held.direction = 'operator_to_client' AND held.processing_state = 'held'
                ORDER BY held.held_sequence, held.created_at, held.rowid
                ON CONFLICT (idempotency_key) DO NOTHING
                """)) {
            statement.setString(1, requestId);
            statement.executeUpdate();
        }
        try (var statement = connection.prepareStatement("""
                UPDATE conversation_messages SET processing_state = 'accepted'
                WHERE request_id = ? AND direction = 'operator_to_client' AND processing_state = 'held'
                """)) {
            statement.setString(1, requestId);
            if (statement.executeUpdate() == 0) {
                return;
            }
        }
        try (var statement = connection.prepareStatement("""
                INSERT INTO usage_events (id, event_type, channel, request_id, occurred_at)
                SELECT 'first-reply:' || id, 'first_reply', channel, id, ? FROM support_requests WHERE id = ?
                ON CONFLICT (id) DO NOTHING
                """)) {
            statement.setString(1, SqliteDatabase.timestamp(now));
            statement.setString(2, requestId);
            statement.executeUpdate();
        }
    }
}
