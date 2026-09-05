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
            ensureColumn("processed_events", "status", "TEXT NOT NULL DEFAULT 'completed'");
            ensureColumn("processed_events", "completed_at", "TEXT");
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS inbound_events (
                        source TEXT NOT NULL, external_event_id TEXT NOT NULL, payload TEXT NOT NULL,
                        received_at TEXT NOT NULL, PRIMARY KEY (source, external_event_id)
                    ) STRICT
                    """);
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

    record Request(String id, long conversation, long topic, boolean active, String channel) { }

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
        return request("operator_topic_id = ?", Long.toString(topic));
    }

    private Request request(String predicate, Object... values) throws SQLException {
        try (var statement = prepare("""
                SELECT id, external_conversation_id, operator_topic_id, status, channel
                FROM support_requests WHERE
                """ + " " + predicate, values); var rows = statement.executeQuery()) {
            return rows.next() ? new Request(rows.getString("id"), rows.getLong("external_conversation_id"),
                    rows.getLong("operator_topic_id"), "active".equals(rows.getString("status")),
                    rows.getString("channel")) : null;
        }
    }

    void open(Request request, Instant now) throws SQLException {
        update("""
                INSERT INTO support_requests (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                VALUES (?, ?, ?, ?, 'active', ?)
                """, request.id(), request.channel(), Long.toString(request.conversation()), Long.toString(request.topic()), now.toString());
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
        update("""
                INSERT OR IGNORE INTO deliveries
                    (id, request_id, idempotency_key, operator_message_id, channel,
                    external_conversation_id, text, status, created_at, next_attempt_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """, UUID.randomUUID().toString(), request.id(), "operator:" + event, Long.toString(message), request.channel(),
                Long.toString(request.conversation()), text, now.toString(), now.toString());
    }

    record Pending(String key, String request, String operatorMessage, long conversation, String text, int attempts, String channel) { }

    List<Pending> pending(Instant now, boolean vkAvailable) throws SQLException {
        try (var statement = prepare("""
                SELECT idempotency_key, request_id, COALESCE(operator_message_id, idempotency_key),
                    external_conversation_id, text, attempts, channel
                FROM deliveries
                WHERE status = 'pending' AND (channel = 'telegram' OR ?) AND julianday(COALESCE(next_attempt_at, created_at))
                    <= julianday(?) ORDER BY julianday(created_at), id LIMIT 25
                """, vkAvailable, now.toString()); var rows = statement.executeQuery()) {
            var result = new ArrayList<Pending>();
            while (rows.next()) {
                result.add(new Pending(rows.getString(1), rows.getString(2), rows.getString(3), rows.getLong(4),
                        rows.getString(5), rows.getInt(6), rows.getString(7)));
            }
            return result;
        }
    }

    void schedule(String key, Instant next) throws SQLException {
        update("""
                UPDATE deliveries SET attempts = attempts + 1, next_attempt_at = ?, last_error = ?
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

    record DeliverySummary(long pending, long sent, long failed) { }

    DeliverySummary summary() throws SQLException {
        try (var statement = connection.createStatement(); var row = statement.executeQuery("""
                SELECT COUNT(*) FILTER (WHERE status = 'pending'),
                    COUNT(*) FILTER (WHERE status = 'sent'), COUNT(*) FILTER (WHERE status = 'failed')
                FROM deliveries
                """)) {
            row.next();
            return new DeliverySummary(row.getLong(1), row.getLong(2), row.getLong(3));
        }
    }

    void deliver(String key, long message, Instant now) throws SQLException {
        update("""
                UPDATE deliveries SET status = 'sent', attempts = attempts + 1, last_error = NULL,
                    external_message_id = ?, sent_at = ? WHERE idempotency_key = ?
                """, Long.toString(message), now.toString(), key);
    }

    void failed(String key, boolean uncertain) throws SQLException {
        update("UPDATE deliveries SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE idempotency_key = ?",
                uncertain ? "Uncertain Telegram result" : "Platform rejected delivery", key);
    }

    record PublicFailure(String id, String channel, int attempts, String createdAt, String reason) { }

    List<PublicFailure> failures() throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery("""
                SELECT id, channel, attempts, created_at, last_error FROM deliveries
                WHERE status = 'failed' ORDER BY julianday(created_at) DESC, id LIMIT 20
                """)) {
            var result = new ArrayList<PublicFailure>();
            while (rows.next()) {
                var reason = "Uncertain Telegram result".equals(rows.getString("last_error"))
                        ? "Итог отправки неизвестен. Проверьте диалог клиента."
                        : "Ответ не доставлен. Проверьте доступ к каналу и повторите отправку.";
                result.add(new PublicFailure(rows.getString("id"), "telegram".equals(rows.getString("channel"))
                        ? "Telegram" : "VK", rows.getInt("attempts"), rows.getString("created_at"), reason));
            }
            return result;
        }
    }

    boolean retry(String id, Instant now) throws SQLException {
        return update("""
                UPDATE deliveries SET status = 'pending', attempts = 0, next_attempt_at = ?, last_error = NULL
                WHERE id = ? AND status = 'failed' AND (last_error IS NULL OR last_error <> 'Uncertain Telegram result')
                """, now.toString(), id) == 1;
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
