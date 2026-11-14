package com.inboxpoint.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;

final class SqliteDeliveryQueue {
    record Delivery(String id, String requestId, String idempotencyKey, String operatorMessageId,
            String channel, String conversationId, String text, String replyToMessageId, Instant createdAt) {
    }

    private final Connection connection;

    SqliteDeliveryQueue(Connection connection) {
        this.connection = connection;
    }

    String enqueue(Delivery delivery) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO deliveries (
                    id, request_id, idempotency_key, operator_message_id, channel, external_conversation_id,
                    text, reply_to_external_message_id, status, attempts, created_at, next_attempt_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)
                ON CONFLICT (idempotency_key) DO NOTHING
                """)) {
            statement.setString(1, delivery.id());
            statement.setString(2, delivery.requestId());
            statement.setString(3, delivery.idempotencyKey());
            statement.setString(4, delivery.operatorMessageId());
            statement.setString(5, delivery.channel());
            statement.setString(6, delivery.conversationId());
            statement.setString(7, delivery.text());
            statement.setString(8, delivery.replyToMessageId());
            var timestamp = SqliteDatabase.timestamp(delivery.createdAt());
            statement.setString(9, timestamp);
            statement.setString(10, timestamp);
            statement.executeUpdate();
        }
        try (var statement = connection.prepareStatement("SELECT id FROM deliveries WHERE idempotency_key = ?")) {
            statement.setString(1, delivery.idempotencyKey());
            try (var result = statement.executeQuery()) {
                if (!result.next()) {
                    throw new SQLException("Failed to persist outbound delivery");
                }
                return result.getString("id");
            }
        }
    }

    List<Delivery> findPending(Instant now, int limit, Set<String> channels) throws SQLException {
        if (channels.isEmpty() || limit <= 0) {
            return List.of();
        }
        var channelParameters = String.join(", ", Collections.nCopies(channels.size(), "?"));
        try (var statement = connection.prepareStatement("""
                SELECT delivery.id, delivery.request_id, delivery.idempotency_key,
                    COALESCE(delivery.operator_message_id, delivery.idempotency_key) AS operator_message_id,
                    delivery.channel, delivery.external_conversation_id, delivery.text,
                    delivery.reply_to_external_message_id, delivery.created_at
                FROM deliveries AS delivery
                WHERE delivery.status = 'pending'
                    AND delivery.channel IN (%s)
                    AND delivery.attempt_started_at IS NULL
                    AND COALESCE(delivery.next_attempt_at, delivery.created_at) <= ?
                    AND NOT EXISTS (
                        SELECT 1 FROM deliveries AS earlier
                        WHERE earlier.status = 'pending'
                            AND earlier.channel = delivery.channel
                            AND earlier.external_conversation_id = delivery.external_conversation_id
                            AND (earlier.created_at, earlier.rowid) < (delivery.created_at, delivery.rowid)
                    )
                ORDER BY delivery.created_at, delivery.rowid
                LIMIT ?
                """.formatted(channelParameters))) {
            int index = 1;
            for (var channel : channels) {
                statement.setString(index++, channel);
            }
            statement.setString(index++, SqliteDatabase.timestamp(now));
            statement.setInt(index, limit);
            try (var rows = statement.executeQuery()) {
                var deliveries = new ArrayList<Delivery>();
                while (rows.next()) {
                    deliveries.add(new Delivery(
                            rows.getString("id"),
                            rows.getString("request_id"),
                            rows.getString("idempotency_key"),
                            rows.getString("operator_message_id"),
                            rows.getString("channel"),
                            rows.getString("external_conversation_id"),
                            rows.getString("text"),
                            rows.getString("reply_to_external_message_id"),
                            Instant.parse(rows.getString("created_at"))));
                }
                return deliveries;
            }
        }
    }

    boolean claim(String id, Instant now) throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE deliveries SET attempt_started_at = ?
                WHERE id = ? AND status = 'pending' AND attempt_started_at IS NULL
                """)) {
            statement.setString(1, SqliteDatabase.timestamp(now));
            statement.setString(2, id);
            return statement.executeUpdate() == 1;
        }
    }

    boolean confirmUnknownReceived(String id, Instant now) throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE deliveries SET status = 'sent', last_error = NULL, next_attempt_at = NULL,
                    outcome_unknown = 0, attempt_started_at = NULL, sent_at = ?,
                    manual_resolution = 'confirmed_received', resolved_at = ?
                WHERE id = ? AND status = 'failed' AND outcome_unknown = 1
                """)) {
            var timestamp = SqliteDatabase.timestamp(now);
            statement.setString(1, timestamp);
            statement.setString(2, timestamp);
            statement.setString(3, id);
            return statement.executeUpdate() == 1;
        }
    }

    boolean retryFailed(String id, boolean confirmedNotReceived, Instant now) throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE deliveries SET status = 'pending', attempts = 0, external_message_id = NULL,
                    last_error = NULL, next_attempt_at = ?, outcome_unknown = 0, attempt_started_at = NULL,
                    sent_at = NULL, operator_notified_at = NULL, notification_next_attempt_at = NULL,
                    manual_resolution = CASE WHEN outcome_unknown = 1
                        THEN 'confirmed_not_received' ELSE manual_resolution END,
                    resolved_at = CASE WHEN outcome_unknown = 1 THEN ? ELSE resolved_at END
                WHERE id = ? AND status = 'failed' AND outcome_unknown = ?
                """)) {
            var timestamp = SqliteDatabase.timestamp(now);
            statement.setString(1, timestamp);
            statement.setString(2, timestamp);
            statement.setString(3, id);
            statement.setInt(4, confirmedNotReceived ? 1 : 0);
            return statement.executeUpdate() == 1;
        }
    }

    void complete(String id, String externalMessageId, String linkId, Instant now) throws SQLException {
        var timestamp = SqliteDatabase.timestamp(now);
        SqliteDatabase.writeTransaction(connection, () -> {
            markSent(id, externalMessageId, timestamp);
            linkSentMessage(id, linkId, timestamp);
        });
    }

    private void markSent(String id, String externalMessageId, String timestamp) throws SQLException {
        try (var statement = connection.prepareStatement("""
                UPDATE deliveries SET status = 'sent', attempts = attempts + 1,
                    external_message_id = ?, last_error = NULL, attempt_started_at = NULL, sent_at = ?
                WHERE id = ? AND status = 'pending' AND attempt_started_at IS NOT NULL
                """)) {
            statement.setString(1, externalMessageId);
            statement.setString(2, timestamp);
            statement.setString(3, id);
            if (statement.executeUpdate() != 1) {
                throw new SQLException("Claimed outbound delivery was not found");
            }
        }
    }

    private void linkSentMessage(String id, String linkId, String timestamp) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO message_links (id, request_id, direction, client_message_id, operator_message_id, created_at)
                SELECT ?, request_id, 'operator_to_client',
                    external_message_id, COALESCE(operator_message_id, idempotency_key), ?
                FROM deliveries WHERE id = ?
                """)) {
            statement.setString(1, linkId);
            statement.setString(2, timestamp);
            statement.setString(3, id);
            statement.executeUpdate();
        }
    }
}
