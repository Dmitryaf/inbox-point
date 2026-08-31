package com.inboxpoint.telegram;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;
import java.util.UUID;

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
        } catch (IOException | SQLException failure) {
            try {
                connection.close();
            } catch (SQLException suppressed) {
                failure.addSuppressed(suppressed);
            }
            throw failure;
        }
    }

    record Request(String id, long conversation, long topic, boolean active) { }

    Request activeRequest(long conversation) throws SQLException {
        return request("external_conversation_id = ? AND status = 'active'", conversation);
    }

    Request byTopic(long topic) throws SQLException {
        return request("operator_topic_id = ?", topic);
    }

    private Request request(String predicate, long value) throws SQLException {
        try (var statement = prepare("""
                SELECT id, external_conversation_id, operator_topic_id, status
                FROM support_requests WHERE channel = 'telegram' AND
                """ + " " + predicate, Long.toString(value)); var rows = statement.executeQuery()) {
            return rows.next() ? new Request(rows.getString("id"), rows.getLong("external_conversation_id"),
                    rows.getLong("operator_topic_id"), "active".equals(rows.getString("status"))) : null;
        }
    }

    void open(Request request, Instant now) throws SQLException {
        update("""
                INSERT INTO support_requests (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                VALUES (?, 'telegram', ?, ?, 'active', ?)
                """, request.id(), Long.toString(request.conversation()), Long.toString(request.topic()), now.toString());
    }

    void changeStatus(String id, boolean active, Instant now) throws SQLException {
        update("UPDATE support_requests SET status = ?, closed_at = ? WHERE id = ?",
                active ? "active" : "closed", active ? null : now.toString(), id);
    }

    boolean claim(String source, String event, Instant now) throws SQLException {
        return update("""
                INSERT OR IGNORE INTO processed_events (source, external_event_id, claimed_at)
                VALUES (?, ?, ?)
                """, source, event, now.toString()) == 1;
    }

    void release(String source, String event) throws SQLException {
        update("DELETE FROM processed_events WHERE source = ? AND external_event_id = ?", source, event);
    }

    void link(String requestId, String direction, long customerMessage, long operatorMessage, Instant now)
            throws SQLException {
        update("""
                INSERT INTO message_links
                    (id, request_id, direction, client_message_id, operator_message_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID().toString(), requestId, direction, Long.toString(customerMessage),
                Long.toString(operatorMessage), now.toString());
    }

    String queue(Request request, String event, String text, Instant now) throws SQLException {
        var key = "operator:" + event;
        update("""
                INSERT OR IGNORE INTO deliveries
                    (id, request_id, idempotency_key, channel, external_conversation_id, text, status, created_at)
                VALUES (?, ?, ?, 'telegram', ?, ?, 'pending', ?)
                """, UUID.randomUUID().toString(), request.id(), key, Long.toString(request.conversation()),
                text, now.toString());
        return key;
    }

    void deliver(String key, long message, Instant now) throws SQLException {
        update("""
                UPDATE deliveries SET status = 'sent', attempts = attempts + 1, last_error = NULL,
                    external_message_id = ?, sent_at = ? WHERE idempotency_key = ?
                """, Long.toString(message), now.toString(), key);
    }

    void failed(String key) throws SQLException {
        update("UPDATE deliveries SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE idempotency_key = ?",
                "Telegram delivery failed", key);
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
