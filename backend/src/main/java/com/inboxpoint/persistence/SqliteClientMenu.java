package com.inboxpoint.persistence;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Optional;

import com.inboxpoint.content.ClientMenu.Intent;
import com.inboxpoint.content.ClientMenu.Response;
import com.inboxpoint.content.ClientMenu.Stage;
import com.inboxpoint.content.ClientMenu.State;
import com.inboxpoint.handoff.ClientMessages;

final class SqliteClientMenu {
    private static final Duration INTENT_TTL = Duration.ofHours(2);

    private final Connection connection;

    SqliteClientMenu(Connection connection) {
        this.connection = connection;
    }

    State state(String channel, String chat, boolean intakePaused, Instant now) throws SQLException {
        var awaiting = intent(channel, chat, now).isPresent();
        try (var query = connection.prepareStatement("""
                SELECT status FROM support_requests WHERE channel = ? AND external_conversation_id = ?
                ORDER BY (status = 'active') DESC, created_at DESC, rowid DESC LIMIT 1
                """)) {
            query.setString(1, channel);
            query.setString(2, chat);
            try (var rows = query.executeQuery()) {
                var status = rows.next() ? rows.getString("status") : null;
                var stage = "active".equals(status) ? Stage.ACTIVE
                        : awaiting ? Stage.AWAITING_QUESTION : status == null ? Stage.FIRST_CONTACT : Stage.CLOSED;
                return new State(stage, intakePaused, awaiting);
            }
        }
    }

    Optional<Intent> intent(String channel, String chat, Instant now) throws SQLException {
        try (var query = connection.prepareStatement("""
                SELECT updated_at, application_label, question_context, class_enrollment, enrollment_confirmation_text
                FROM client_conversation_states
                WHERE channel = ? AND external_conversation_id = ? AND state = 'awaiting_question'
                """)) {
            query.setString(1, channel);
            query.setString(2, chat);
            try (var rows = query.executeQuery()) {
                if (!rows.next()) {
                    return Optional.empty();
                }
                if (isCurrent(rows.getString("updated_at"), now)) {
                    var label = rows.getString("application_label");
                    var question = rows.getString("question_context");
                    var confirmation = rows.getString("enrollment_confirmation_text");
                    if (rows.getInt("class_enrollment") != 1 || label == null) {
                        confirmation = null;
                    } else if (confirmation == null) {
                        confirmation = ClientMessages.DEFAULT_ENROLLMENT_CONFIRMATION;
                    }
                    return Optional.of(new Intent(label, question, confirmation));
                }
            }
        }
        clearIntent(channel, chat);
        return Optional.empty();
    }

    void save(String channel, String chat, String eventId, Response response, Instant now) throws SQLException {
        if (response.cancelIntent()) {
            clearIntent(channel, chat);
        }
        if (response.intent() != null) {
            setIntent(channel, chat, response.intent(), now);
        }
        if (response.actionKey() == null) {
            return;
        }
        try (var statement = connection.prepareStatement("""
                INSERT INTO usage_events (id, event_type, channel, request_id, action_key, action_label, occurred_at)
                VALUES (?, 'menu_action', ?, (
                    SELECT id FROM support_requests WHERE channel = ? AND external_conversation_id = ?
                        AND status = 'active' LIMIT 1
                ), ?, ?, ?) ON CONFLICT (id) DO NOTHING
                """)) {
            statement.setString(1, "menu:" + channel + ":" + eventId);
            statement.setString(2, channel);
            statement.setString(3, channel);
            statement.setString(4, chat);
            statement.setString(5, response.actionKey());
            statement.setString(6, response.actionLabel());
            statement.setString(7, SqliteDatabase.timestamp(now));
            statement.executeUpdate();
        }
    }

    void clearIntent(String channel, String chat) throws SQLException {
        try (var statement = connection.prepareStatement("""
                DELETE FROM client_conversation_states WHERE channel = ? AND external_conversation_id = ?
                """)) {
            statement.setString(1, channel);
            statement.setString(2, chat);
            statement.executeUpdate();
        }
    }

    private void setIntent(String channel, String chat, Intent intent, Instant now) throws SQLException {
        try (var statement = connection.prepareStatement("""
                INSERT INTO client_conversation_states
                    (channel, external_conversation_id, state, updated_at, application_label, question_context,
                     class_enrollment, enrollment_confirmation_text)
                VALUES (?, ?, 'awaiting_question', ?, ?, ?, ?, ?)
                ON CONFLICT (channel, external_conversation_id) DO UPDATE SET
                    state = excluded.state, updated_at = excluded.updated_at, application_label = excluded.application_label,
                    question_context = excluded.question_context, class_enrollment = excluded.class_enrollment,
                    enrollment_confirmation_text = excluded.enrollment_confirmation_text
                """)) {
            statement.setString(1, channel);
            statement.setString(2, chat);
            statement.setString(3, SqliteDatabase.timestamp(now));
            statement.setString(4, intent.applicationLabel());
            statement.setString(5, intent.questionContext());
            statement.setInt(6, intent.enrollmentConfirmation() == null ? 0 : 1);
            statement.setString(7, intent.enrollmentConfirmation());
            statement.executeUpdate();
        }
    }

    private static boolean isCurrent(String updatedAt, Instant now) {
        try {
            return Instant.parse(updatedAt).isAfter(now.minus(INTENT_TTL));
        } catch (DateTimeParseException failure) {
            return false;
        }
    }
}
