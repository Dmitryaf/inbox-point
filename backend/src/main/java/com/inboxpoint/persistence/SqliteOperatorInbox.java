package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.inboxpoint.persistence.SqliteTextHandoff.WebActionResult;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Repository;

@Repository
public final class SqliteOperatorInbox {
    private static final int REQUEST_LIMIT = 50;
    private static final int MESSAGE_LIMIT = 200;
    private final Path database;

    public SqliteOperatorInbox(Environment environment) {
        database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
    }

    public Page<Request, RequestCursor> requests(RequestCursor before) throws SQLException {
        var requests = new ArrayList<Request>();
        try (var connection = SqliteDatabase.openExisting(database, true);
                var query = connection.prepareStatement("""
                        SELECT request.id, request.created_at, request.channel, request.client_display_name, request.status,
                            MAX(message.created_at) AS latest_message_at
                        FROM support_requests AS request
                        LEFT JOIN conversation_messages AS message ON message.request_id = request.id
                        WHERE request.status = 'active' AND request.operator_topic_id GLOB 'web:*'
                            AND (? IS NULL OR (request.created_at, request.id) < (?, ?))
                        GROUP BY request.id ORDER BY request.created_at DESC, request.id DESC LIMIT ?
                        """)) {
            bindDate(query, 1, before == null ? null : before.createdAt());
            query.setString(3, before == null ? null : before.id());
            query.setInt(4, REQUEST_LIMIT + 1);
            try (var rows = query.executeQuery()) {
                while (rows.next()) {
                    requests.add(new Request(rows.getString("id"), rows.getString("channel"), rows.getString("status"),
                            rows.getString("created_at"), optionalText(rows.getString("client_display_name")),
                            rows.getString("latest_message_at")));
                }
            }
        }
        RequestCursor next = null;
        if (requests.size() > REQUEST_LIMIT) {
            requests.removeLast();
            var last = requests.getLast();
            next = new RequestCursor(last.createdAt(), last.id());
        }
        return new Page<>(List.copyOf(requests), next);
    }

    public Optional<Page<Message, MessageCursor>> messages(String requestId, MessageCursor before) throws SQLException {
        try (var connection = SqliteDatabase.openExisting(database, true)) {
            connection.setAutoCommit(false);
            try (var request = connection.prepareStatement("""
                    SELECT 1 FROM support_requests WHERE id = ? AND operator_topic_id GLOB 'web:*'
                    """)) {
                request.setString(1, requestId);
                try (var rows = request.executeQuery()) {
                    if (!rows.next()) {
                        return Optional.empty();
                    }
                }
            }
            var messages = new ArrayList<Message>();
            long oldestRowId = 0;
            boolean hasMore = false;
            try (var query = connection.prepareStatement("""
                    SELECT message.id, message.rowid AS message_rowid, message.created_at, message.direction,
                        message.sender_name, message.text, delivery.status AS delivery_status,
                        delivery.outcome_unknown AS delivery_outcome_unknown
                    FROM conversation_messages AS message
                    LEFT JOIN deliveries AS delivery ON delivery.request_id = message.request_id
                        AND delivery.operator_message_id = message.external_message_id
                    WHERE message.request_id = ? AND message.processing_state = 'accepted'
                        AND (? IS NULL OR (message.created_at, message.rowid) < (?, ?))
                    ORDER BY message.created_at DESC, message.rowid DESC LIMIT ?
                    """)) {
                query.setString(1, requestId);
                bindDate(query, 2, before == null ? null : before.createdAt());
                query.setLong(4, before == null ? 0 : before.rowId());
                query.setInt(5, MESSAGE_LIMIT + 1);
                try (var rows = query.executeQuery()) {
                    while (rows.next()) {
                        if (messages.size() == MESSAGE_LIMIT) {
                            hasMore = true;
                            break;
                        }
                        oldestRowId = rows.getLong("message_rowid");
                        var outcome = rows.getBoolean("delivery_outcome_unknown");
                        Boolean deliveryOutcome = rows.wasNull() ? null : outcome;
                        messages.add(new Message(rows.getString("id"), rows.getString("created_at"), rows.getString("direction"),
                                rows.getString("text"), optionalText(rows.getString("sender_name")),
                                rows.getString("delivery_status"), deliveryOutcome));
                    }
                }
            }
            connection.commit();
            Collections.reverse(messages);
            var next = hasMore ? new MessageCursor(messages.getFirst().createdAt(), oldestRowId) : null;
            return Optional.of(new Page<>(List.copyOf(messages), next));
        }
    }

    public WebActionResult reply(String requestId, String key, String text, Instant now) throws SQLException {
        try (var store = SqliteTextHandoff.openExisting(database)) {
            return store.replyFromWeb(requestId, key, text, now);
        }
    }

    public WebActionResult close(String requestId, String key, Instant now) throws SQLException {
        try (var store = SqliteTextHandoff.openExisting(database)) {
            return store.closeFromWeb(requestId, key, now);
        }
    }

    private static void bindDate(PreparedStatement statement, int index, String date) throws SQLException {
        statement.setString(index, date);
        statement.setString(index + 1, date);
    }

    private static String optionalText(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    public record Page<T, C>(List<T> items, C next) { }

    public record RequestCursor(String createdAt, String id) { }

    public record MessageCursor(String createdAt, long rowId) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Request(String id, String channel, String status, String createdAt, String displayName, String latestMessageAt) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Message(String id, String createdAt, String direction, String text, String senderName, String deliveryStatus,
            Boolean deliveryOutcomeUnknown) { }
}
