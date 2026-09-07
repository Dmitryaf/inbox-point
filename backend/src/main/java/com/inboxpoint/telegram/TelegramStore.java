package com.inboxpoint.telegram;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.inboxpoint.vk.VkChannel;
import tools.jackson.databind.json.JsonMapper;

import org.sqlite.SQLiteConfig;

final class TelegramStore implements AutoCloseable {
    private final Connection connection;

    TelegramStore(Path path) throws IOException, SQLException {
        Files.createDirectories(path.toAbsolutePath().getParent());
        var config = new SQLiteConfig();
        config.enforceForeignKeys(true);
        config.setBusyTimeout(5000);
        config.setJournalMode(SQLiteConfig.JournalMode.WAL);
        config.setSynchronous(SQLiteConfig.SynchronousMode.FULL);
        connection = config.createConnection("jdbc:sqlite:" + path.toAbsolutePath());
        try (var schema = TelegramStore.class.getResourceAsStream("/db/sqlite/telegram-handoff.sql");
                var statement = connection.createStatement()) {
            if (schema == null) {
                throw new IOException("Telegram storage schema is missing");
            }
            var sql = new String(schema.readAllBytes(), StandardCharsets.UTF_8);
            for (var command : sql.split(";")) {
                if (!command.isBlank()) {
                    statement.execute(command);
                }

            }
            ensureColumn("deliveries", "operator_message_id", "TEXT");
            ensureColumn("deliveries", "next_attempt_at", "TEXT");
            ensureColumn("deliveries", "outcome_unknown", "INTEGER NOT NULL DEFAULT 0");
            ensureColumn("deliveries", "manual_resolution",
                    "TEXT CHECK (manual_resolution IN ('confirmed_received', 'confirmed_not_received'))");
            ensureColumn("deliveries", "resolved_at", "TEXT");
            ensureColumn("deliveries", "operator_notified_at", "TEXT");
            ensureColumn("deliveries", "notification_next_attempt_at", "TEXT");
            ensureColumn("deliveries", "attempt_started_at", "TEXT");
            statement.execute("UPDATE deliveries SET outcome_unknown = 1 WHERE last_error = 'Uncertain Telegram result' "
                    + "AND status = 'failed' AND outcome_unknown = 0");
            try (var version = statement.executeQuery("PRAGMA user_version")) {
                if (version.next() && version.getInt(1) > 2) {
                    throw new SQLException("Unsupported SQLite schema version");
                }
            }
            ensureColumn("support_requests", "client_display_name", "TEXT");
            ensureColumn("processed_events", "status", "TEXT NOT NULL DEFAULT 'completed'");
            ensureColumn("processed_events", "completed_at", "TEXT");
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS inbound_events (
                        source TEXT NOT NULL, external_event_id TEXT NOT NULL, payload TEXT NOT NULL,
                        received_at TEXT NOT NULL, PRIMARY KEY (source, external_event_id)
                    ) STRICT
                    """);
            statement.execute("PRAGMA user_version = 2");
        } catch (IOException | SQLException failure) {
            try {
                connection.close();
            } catch (SQLException suppressed) {
                failure.addSuppressed(suppressed);
            }
            throw failure;
        }
    }

    private void ensureColumn(String table, String name, String definition) throws SQLException {
        try (var statement = prepare("SELECT 1 FROM pragma_table_info(?) WHERE name = ?", table, name);
                var columns = statement.executeQuery()) {
            if (columns.next()) {
                return;
            }
        }
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + table + " ADD COLUMN " + name + " " + definition);
        }
    }

    record Request(String id, long conversation, String topic, boolean active, String channel) {
        Request(String id, long conversation, long topic, boolean active, String channel) {
            this(id, conversation, Long.toString(topic), active, channel);
        }
    }

    Request activeRequest(long conversation) throws SQLException {
        return activeRequest("telegram", conversation);
    }

    Request activeRequest(String channel, long conversation) throws SQLException {
        return request("channel = ? AND external_conversation_id = ? AND status = 'active'",
                channel, Long.toString(conversation));
    }

    Request latestRequest(String channel, long conversation) throws SQLException {
        return request("channel = ? AND external_conversation_id = ? ORDER BY julianday(created_at) DESC, rowid DESC LIMIT 1",
                channel, Long.toString(conversation));
    }

    Request byTopic(long topic) throws SQLException {
        return byTopic(Long.toString(topic));
    }

    Request byTopic(String topic) throws SQLException {
        return request("operator_topic_id = ?", topic);
    }

    Request byId(String id) throws SQLException {
        return request("id = ?", id);
    }

    private Request request(String predicate, Object... values) throws SQLException {
        try (var statement = prepare("""
                SELECT id, external_conversation_id, operator_topic_id, status, channel
                FROM support_requests WHERE
                """ + " " + predicate, values); var rows = statement.executeQuery()) {
            return rows.next() ? new Request(rows.getString("id"), rows.getLong("external_conversation_id"),
                    rows.getString("operator_topic_id"), "active".equals(rows.getString("status")),
                    rows.getString("channel")) : null;
        }
    }

    void open(Request request, Instant now) throws SQLException {
        open(request, null, now);
    }

    void open(Request request, String displayName, Instant now) throws SQLException {
        update("""
                INSERT INTO support_requests (id, channel, external_conversation_id, operator_topic_id, status,
                    created_at, client_display_name)
                VALUES (?, ?, ?, ?, 'active', ?, ?)
                """, request.id(), request.channel(), Long.toString(request.conversation()), request.topic(), now.toString(), displayName);
    }

    boolean switchTopic(String id, String current, String replacement) throws SQLException {
        return update("UPDATE support_requests SET operator_topic_id = ? WHERE id = ? AND operator_topic_id = ?",
                replacement, id, current) == 1;
    }

    void changeStatus(String id, boolean active, Instant now) throws SQLException {
        update("UPDATE support_requests SET status = ?, closed_at = ? WHERE id = ?",
                active ? "active" : "closed", active ? null : now.toString(), id);
    }

    boolean claim(String source, String event, Instant now) throws SQLException {
        return update("""
                INSERT OR IGNORE INTO processed_events (source, external_event_id, claimed_at, status)
                VALUES (?, ?, ?, 'processing')
                """, source, event, now.toString()) == 1;
    }

    void release(String source, String event) throws SQLException {
        update("DELETE FROM processed_events WHERE source = ? AND external_event_id = ? AND status = 'processing'", source, event);
    }

    void completeEvent(String source, String event, Instant now) throws SQLException {
        update("""
                UPDATE processed_events SET status = 'completed', completed_at = ?
                WHERE source = ? AND external_event_id = ? AND status = 'processing'
                """, now.toString(), source, event);
    }

    void recoverInterrupted() throws SQLException {
        update("DELETE FROM processed_events WHERE status = 'processing'");
        update("""
                UPDATE deliveries SET status = 'failed', attempts = attempts + 1,
                    outcome_unknown = 1, attempt_started_at = NULL, last_error = ?
                WHERE status = 'pending' AND attempt_started_at IS NOT NULL
                """, "Delivery was interrupted after the attempt started");
    }

    void saveVkBatch(List<VkChannel.Message> batch, Instant now) throws SQLException {
        connection.setAutoCommit(false);
        try {
            for (var item : batch) {
                update("""
                        INSERT OR IGNORE INTO inbound_events (source, external_event_id, payload, received_at)
                        VALUES ('vk:long-poll', ?, ?, ?)
                        """, item.event(), JsonMapper.shared().valueToTree(item).toString(), now.toString());
            }
            connection.commit();
        } catch (SQLException | RuntimeException failure) {
            connection.rollback();
            throw failure;
        } finally {
            connection.setAutoCommit(true);
        }
    }

    VkChannel.Message nextVk() throws SQLException {
        try (var query = connection.createStatement(); var row = query.executeQuery("""
                SELECT payload FROM inbound_events WHERE source = 'vk:long-poll'
                ORDER BY received_at, rowid LIMIT 1
                """)) {
            return row.next() ? JsonMapper.shared().readValue(row.getString(1), VkChannel.Message.class) : null;
        }
    }

    void deleteVk(String event) throws SQLException {
        update("DELETE FROM inbound_events WHERE source = 'vk:long-poll' AND external_event_id = ?", event);
    }

    void link(String requestId, String direction, String customerMessage, String operatorMessage, Instant now)
            throws SQLException {
        update("""
                INSERT INTO message_links
                    (id, request_id, direction, client_message_id, operator_message_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID().toString(), requestId, direction, customerMessage, operatorMessage, now.toString());
    }

    void queue(Request request, String event, long message, String text, Instant now) throws SQLException {
        queue(request, event, Long.toString(message), text, now);
    }

    void queue(Request request, String event, String message, String text, Instant now) throws SQLException {
        connection.setAutoCommit(false);
        try {
            recordMessage(request.id(), "operator_to_client", message, null, text, now);
            insertDelivery(request, event, message, text, now);
            connection.commit();
        } catch (SQLException failure) {
            connection.rollback();
            throw failure;
        } finally {
            connection.setAutoCommit(true);
        }
    }

    private void insertDelivery(Request request, String event, String message, String text, Instant now) throws SQLException {
        update("""
                INSERT OR IGNORE INTO deliveries
                    (id, request_id, idempotency_key, operator_message_id, channel,
                    external_conversation_id, text, status, created_at, next_attempt_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """, UUID.randomUUID().toString(), request.id(), "operator:" + event, message, request.channel(),
                Long.toString(request.conversation()), text, now.toString(), now.toString());
    }

    void acknowledge(Request request, String text, Instant now) throws SQLException {
        var key = "system:handoff-ack:" + request.id();
        update("""
                INSERT OR IGNORE INTO deliveries
                    (id, request_id, idempotency_key, operator_message_id, channel,
                    external_conversation_id, text, status, created_at, next_attempt_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """, key, request.id(), key, key, request.channel(),
                Long.toString(request.conversation()), text, now.toString(), now.toString());
    }

    void pilotEvent(String id, String type, String channel, String request, Instant now) throws SQLException {
        update("INSERT OR IGNORE INTO pilot_events (id, event_type, channel, request_id, occurred_at) VALUES (?, ?, ?, ?, ?)",
                id, type, channel, request, now.toString());
    }

    java.util.Map<String, Long> pilotCounts(Instant since) throws SQLException {
        var result = new java.util.LinkedHashMap<String, Long>();
        for (var type : List.of("new_request", "information_section", "first_reply", "delivery_failure", "web_takeover")) {
            result.put(type, 0L);
        }
        try (var statement = prepare("""
                SELECT event_type, COUNT(*) FROM pilot_events WHERE julianday(occurred_at) >= julianday(?)
                GROUP BY event_type
                """, since.toString()); var rows = statement.executeQuery()) {
            while (rows.next()) {
                result.put(rows.getString(1), rows.getLong(2));
            }
        }
        return result;
    }

    void recordMessage(String request, String direction, String message, String sender, String text, Instant now)
            throws SQLException {
        update("""
                INSERT OR IGNORE INTO conversation_messages
                    (id, request_id, direction, external_message_id, sender_name, text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID().toString(), request, direction, message, sender, text, now.toString());
    }

    List<TelegramRuntime.InboxRequest> activeOperatorRequests() throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                SELECT r.id, r.channel, r.created_at, r.client_display_name, r.status,
                    MAX(m.created_at) AS latest_message_at
                FROM support_requests r LEFT JOIN conversation_messages m ON m.request_id = r.id
                WHERE r.status = 'active' AND r.operator_topic_id LIKE 'web:%' GROUP BY r.id
                ORDER BY julianday(COALESCE(MAX(m.created_at), r.created_at)) DESC, r.id DESC LIMIT 50
                """)) {
            var result = new ArrayList<TelegramRuntime.InboxRequest>();
            while (rows.next()) {
                result.add(new TelegramRuntime.InboxRequest(rows.getString("id"), rows.getString("channel"),
                        rows.getString("created_at"), rows.getString("client_display_name"),
                        rows.getString("latest_message_at"), rows.getString("status")));
            }
            return result;
        }
    }

    List<TelegramRuntime.InboxMessage> operatorMessages(String request) throws SQLException {
        try (var statement = prepare("""
                SELECT * FROM (
                    SELECT m.id, m.direction, m.sender_name, m.text, m.created_at,
                        d.status AS delivery_status, d.outcome_unknown
                    FROM conversation_messages m LEFT JOIN deliveries d ON m.direction = 'operator_to_client'
                        AND m.request_id = d.request_id AND m.external_message_id = d.operator_message_id
                    WHERE m.request_id = ? ORDER BY julianday(m.created_at) DESC, m.rowid DESC LIMIT 200
                ) ORDER BY julianday(created_at), id
                """, request); var rows = statement.executeQuery()) {
            var result = new ArrayList<TelegramRuntime.InboxMessage>();
            while (rows.next()) {
                var status = rows.getString("delivery_status");
                result.add(new TelegramRuntime.InboxMessage(rows.getString("id"), rows.getString("direction"),
                        rows.getString("text"), rows.getString("sender_name"), rows.getString("created_at"),
                        status, status == null ? null : rows.getInt("outcome_unknown") != 0));
            }
            return result;
        }
    }

    record Pending(String key, String request, String operatorMessage, long conversation, String text, int attempts, String channel) { }

    List<Pending> pending(Instant now, boolean vkAvailable) throws SQLException {
        return pending(now, true, vkAvailable);
    }

    List<Pending> pending(Instant now, boolean telegramAvailable, boolean vkAvailable) throws SQLException {
        try (var statement = prepare("""
                SELECT idempotency_key, request_id, COALESCE(operator_message_id, idempotency_key),
                    external_conversation_id, text, attempts, channel
                FROM deliveries
                WHERE status = 'pending' AND attempt_started_at IS NULL AND ((channel = 'telegram' AND ?) OR (channel = 'vk' AND ?)) AND julianday(COALESCE(next_attempt_at, created_at))
                    <= julianday(?) ORDER BY julianday(created_at), id LIMIT 25
                """, telegramAvailable, vkAvailable, now.toString()); var rows = statement.executeQuery()) {
            var result = new ArrayList<Pending>();
            while (rows.next()) {
                result.add(new Pending(rows.getString(1), rows.getString(2), rows.getString(3), rows.getLong(4),
                        rows.getString(5), rows.getInt(6), rows.getString(7)));
            }
            return result;
        }
    }

    boolean beginAttempt(String key, Instant started) throws SQLException {
        return update("""
                UPDATE deliveries SET attempt_started_at = ?
                WHERE status = 'pending' AND idempotency_key = ? AND attempt_started_at IS NULL
                """, started.toString(), key) == 1;
    }

    void schedule(String key, Instant next) throws SQLException {
        update("""
                UPDATE deliveries SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?, attempt_started_at = NULL
                WHERE idempotency_key = ? AND status = 'pending'
                """, next.toString(), "Telegram delivery rejected", key);
    }

    void complete(Pending item, long sent, Instant now) throws SQLException {
        connection.setAutoCommit(false);
        try {
            deliver(item.key(), sent, now);
            link(item.request(), "operator_to_client", Long.toString(sent), item.operatorMessage(), now);
            connection.commit();
        } catch (SQLException failure) {
            connection.rollback();
            throw failure;
        } finally {
            connection.setAutoCommit(true);
        }
    }

    record DeliverySummary(long pending, long sent, long failed, String oldestPending, long uncertain) { }

    DeliverySummary summary() throws SQLException {
        try (var statement = connection.createStatement(); var row = statement.executeQuery("""
                SELECT COUNT(*) FILTER (WHERE status = 'pending'),
                    COUNT(*) FILTER (WHERE status = 'sent'), COUNT(*) FILTER (WHERE status = 'failed'),
                    MIN(created_at) FILTER (WHERE status = 'pending'), COUNT(*) FILTER (WHERE outcome_unknown = 1)
                FROM deliveries
                """)) {
            row.next();
            return new DeliverySummary(row.getLong(1), row.getLong(2), row.getLong(3), row.getString(4), row.getLong(5));
        }
    }

    void deliver(String key, long message, Instant now) throws SQLException {
        update("""
                UPDATE deliveries SET status = 'sent', attempts = attempts + 1, last_error = NULL,
                    external_message_id = ?, sent_at = ?, attempt_started_at = NULL WHERE idempotency_key = ?
                """, Long.toString(message), now.toString(), key);
    }

    void failed(String key, boolean uncertain, String reason) throws SQLException {
        update("""
                UPDATE deliveries SET status = 'failed', attempts = attempts + 1, last_error = ?, outcome_unknown = ?, attempt_started_at = NULL,
                    operator_notified_at = NULL, notification_next_attempt_at = NULL
                WHERE idempotency_key = ?
                """, reason, uncertain ? 1 : 0, key);
    }

    record PublicFailure(String id, String channel, int attempts, String createdAt, String reason, boolean retryAllowed) { }

    List<PublicFailure> failures() throws SQLException {
        return incidents().stream().map(item -> new PublicFailure(item.id(), item.channel(), item.attempts(),
                item.createdAt(), item.reason(), item.retryAllowed())).toList();
    }

    List<TelegramRuntime.DeliveryIncident> incidents() throws SQLException {
        return incidents("WHERE d.status = 'failed' ORDER BY julianday(d.created_at) DESC, d.id LIMIT 20");
    }

    List<TelegramRuntime.DeliveryIncident> unnotified(Instant now) throws SQLException {
        return incidents("""
                WHERE d.status = 'failed' AND d.operator_notified_at IS NULL
                    AND julianday(COALESCE(d.notification_next_attempt_at, d.created_at)) <= julianday(?)
                ORDER BY julianday(d.created_at), d.id LIMIT 10
                """, now.toString());
    }

    private List<TelegramRuntime.DeliveryIncident> incidents(String selection, Object... parameters) throws SQLException {
        try (var statement = prepare("""
                SELECT d.id, d.channel, d.attempts, d.created_at, d.last_error, d.outcome_unknown,
                    d.operator_message_id, d.request_id, request.operator_topic_id
                FROM deliveries d JOIN support_requests request ON request.id = d.request_id
                """ + selection, parameters); var rows = statement.executeQuery()) {
            var result = new ArrayList<TelegramRuntime.DeliveryIncident>();
            while (rows.next()) {
                var uncertain = rows.getInt("outcome_unknown") != 0;
                var telegram = "telegram".equals(rows.getString("channel"));
                var reason = uncertain
                        ? "Канал мог принять ответ, но подтверждение не получено. Автоматический повтор отключён, чтобы не отправить дубликат."
                        : failureReason(rows.getString("last_error"), telegram);
                result.add(new TelegramRuntime.DeliveryIncident(rows.getString("id"), telegram ? "Telegram" : "VK",
                        rows.getInt("attempts"), rows.getString("created_at"), reason, !uncertain, uncertain,
                        rows.getString("request_id"), rows.getString("operator_topic_id"), rows.getString("operator_message_id")));
            }
            return result;
        }
    }

    private static String failureReason(String error, boolean telegram) {
        var normalized = error == null ? "" : error.toLowerCase(java.util.Locale.ROOT);
        if (normalized.contains("blocked") || normalized.contains("chat not found")
                || normalized.contains("user is deactivated") || normalized.contains("forbidden")
                || normalized.equals("api 403")) {
            return "Бот не может написать клиенту. Возможно, клиент заблокировал бота.";
        }
        if (normalized.contains("unauthorized") || normalized.contains("invalid token") || normalized.equals("api 401")) {
            return telegram ? "Telegram не принимает подключение бота. Переподключите Telegram."
                    : "VK не принимает ключ сообщества. Переподключите VK.";
        }
        if (normalized.contains("too many requests") || normalized.contains("429")) {
            return "Канал временно ограничил отправку. Повторите попытку позже.";
        }
        if (normalized.contains("request failed") || normalized.contains("network")
                || normalized.contains("timeout") || normalized.contains("econn")) {
            return "Не удалось связаться с каналом. Проверьте интернет и повторите попытку.";
        }
        return telegram ? "Telegram не доставил ответ. Проверьте подключение и повторите попытку."
                : "VK не доставил ответ. Проверьте подключение и повторите попытку.";
    }

    boolean retry(String id, Instant now) throws SQLException {
        return update("""
                UPDATE deliveries SET status = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL, attempt_started_at = NULL,
                    operator_notified_at = NULL, notification_next_attempt_at = NULL
                WHERE id = ? AND status = 'failed' AND outcome_unknown = 0
                """, now.toString(), id) == 1;
    }

    boolean resolve(String id, boolean received, Instant now) throws SQLException {
        var timestamp = now.toString();
        if (received) {
            return update("""
                    UPDATE deliveries SET status = 'sent', last_error = NULL, next_attempt_at = NULL,
                        outcome_unknown = 0, attempt_started_at = NULL, sent_at = ?,
                        manual_resolution = 'confirmed_received', resolved_at = ?
                    WHERE id = ? AND status = 'failed' AND outcome_unknown = 1
                    """, timestamp, timestamp, id) == 1;
        }
        return update("""
                UPDATE deliveries SET status = 'pending', attempts = 0, external_message_id = NULL,
                    last_error = NULL, next_attempt_at = ?, outcome_unknown = 0, attempt_started_at = NULL,
                    sent_at = NULL, manual_resolution = 'confirmed_not_received', resolved_at = ?,
                    operator_notified_at = NULL, notification_next_attempt_at = NULL
                WHERE id = ? AND status = 'failed' AND outcome_unknown = 1
                """, timestamp, timestamp, id) == 1;
    }

    void notified(String id, Instant now) throws SQLException {
        update("""
                UPDATE deliveries SET operator_notified_at = ?, notification_next_attempt_at = NULL
                WHERE id = ? AND status = 'failed' AND operator_notified_at IS NULL
                """, now.toString(), id);
    }

    void notificationRetry(String id, Instant now) throws SQLException {
        update("""
                UPDATE deliveries SET notification_next_attempt_at = ?
                WHERE id = ? AND status = 'failed' AND operator_notified_at IS NULL
                """, now.toString(), id);
    }

    com.inboxpoint.persistence.SqliteRetention.Result purge(Instant cutoff) throws SQLException {
        return com.inboxpoint.persistence.SqliteRetention.purge(connection, cutoff);
    }

    void backup(Path destination) throws IOException, SQLException {
        Files.createDirectories(destination.toAbsolutePath().getParent());
        var temporary = destination.resolveSibling(destination.getFileName() + ".tmp");
        try {
            try (var copy = prepare("VACUUM INTO ?", temporary.toString())) {
                copy.execute();
            }
            var config = new SQLiteConfig();
            config.setReadOnly(true);
            try (var saved = config.createConnection("jdbc:sqlite:" + temporary);
                    var check = saved.createStatement();
                    var result = check.executeQuery("PRAGMA quick_check")) {
                if (!result.next() || !"ok".equals(result.getString(1))) {
                    throw new SQLException("SQLite backup integrity verification failed");
                }
            }
            Files.move(temporary, destination, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    private PreparedStatement prepare(String sql, Object... values) throws SQLException {
        var statement = connection.prepareStatement(sql);
        try {
            for (int index = 0; index < values.length; index++) {
                statement.setObject(index + 1, values[index]);
            }
            return statement;
        } catch (SQLException failure) {
            statement.close();
            throw failure;
        }
    }

    private int update(String sql, Object... values) throws SQLException {
        try (var statement = prepare(sql, values)) {
            return statement.executeUpdate();
        }
    }

    @Override
    public void close() throws SQLException {
        connection.close();
    }
}
