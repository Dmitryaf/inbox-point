package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.inboxpoint.content.ClientMenu;
import com.inboxpoint.handoff.ClientMessages;

public final class SqliteTextHandoff implements AutoCloseable {
    private static final String OPERATOR_SOURCE = "operator:telegram";
    private static final String VK_NATIVE_SOURCE = "operator:vk:native";
    private static final String WEB_SOURCE = "operator:web";

    private final Connection connection;
    private final SqliteInboundEvents inbound;
    private final SqliteDeliveryQueue deliveries;
    private final SqliteClientMenu clientMenu;

    private SqliteTextHandoff(Connection connection) {
        this.connection = connection;
        this.inbound = new SqliteInboundEvents(connection);
        this.deliveries = new SqliteDeliveryQueue(connection);
        this.clientMenu = new SqliteClientMenu(connection);
    }

    public static SqliteTextHandoff open(Path database, Instant now) throws SQLException {
        var connection = SqliteDatabase.openOrMigrate(database);
        try {
            SqliteStartupRecovery.recoverInterruptedWork(connection, now);
            return new SqliteTextHandoff(connection);
        } catch (SQLException | RuntimeException failure) {
            try {
                connection.close();
            } catch (SQLException closeFailure) {
                failure.addSuppressed(closeFailure);
            }
            throw failure;
        }
    }

    public static SqliteTextHandoff openExisting(Path database) throws SQLException {
        return new SqliteTextHandoff(SqliteDatabase.openExisting(database));
    }

    public boolean queuesReady(boolean deliveryPaused, Instant now) throws SQLException {
        try (var query = prepare("""
                SELECT NOT EXISTS (
                    SELECT 1 FROM inbound_events WHERE status = 'quarantined'
                    UNION ALL SELECT 1 FROM operator_actions AS action WHERE action.status = 'outcome_unknown'
                        OR (action.kind = 'reopen_request' AND (action.status = 'failed'
                            OR (action.status = 'abandoned' AND action.manual_resolution = 'confirmed_not_completed'))
                            AND EXISTS (SELECT 1 FROM conversation_messages AS held
                                WHERE held.prerequisite_action_id = action.id AND held.processing_state = 'held'))
                    UNION ALL SELECT 1 FROM support_requests WHERE status = 'active' AND web_owned_at IS NULL
                        AND operator_topic_id LIKE 'web:%'
                    UNION ALL SELECT 1 FROM deliveries WHERE ? = 0
                        AND (status = 'failed' OR (status = 'pending' AND created_at < ?))
                ) AS ready
                """, deliveryPaused ? 1 : 0, SqliteDatabase.timestamp(now.minusSeconds(300)));
                var rows = query.executeQuery()) {
            return rows.next() && rows.getBoolean("ready");
        }
    }

    public record IncomingUpdate(String id, String payload) {
    }

    public record PendingUpdate(String id, String payload, Instant retryAt) {
    }

    public record EnrollmentNotification(String enrollmentId, String operatorMessageId) {
    }

    public record DeliveryNotification(String id, String channel, String topicId, String messageId, boolean uncertain) { }

    public record ClientText(String channel, String eventId, String chatId, String messageId, String sender, String text,
            Instant receivedAt) {
        public ClientText(String eventId, String chatId, String messageId, String sender, String text,
                Instant receivedAt) {
            this("telegram", eventId, chatId, messageId, sender, text, receivedAt);
        }
    }

    public record NativeOperatorText(String eventId, String chatId, String messageId, String text, Instant receivedAt) {
    }

    public record ClientHistory(String messageId, String sender, String text, String enrollmentId) {
    }

    public record WebRecovery(Request request, List<ClientHistory> messages, String applicationMessageId,
            String reusableTopic, OperatorAction opening) { }

    public record Request(String id, String channel, String chatId, String topicId, String status) {
    }

    public record ClientRelay(Request request, boolean initial, boolean openingTopic, String reusableTopicId,
            String text, boolean application, String enrollmentId) {
    }

    public record OperatorAction(String id, String requestId, String kind, String clientMessageId,
            String topicId, int sequence, boolean initial) {
    }

    public record ClaimedAction(String status, String externalResultId) {
    }

    public record HeldReply(OperatorAction prerequisite, boolean startReopen) {
    }

    public enum WebActionResult {
        ACCEPTED, NOT_FOUND, CLOSED
    }

    public enum ChannelIdentity {
        ACCEPTED, CONFLICT, LEGACY_UNBOUND
    }

    public enum TopicTransition {
        CLOSE("close", "close_request"), REOPEN("reopen", "reopen_request");

        private final String command;
        private final String kind;

        TopicTransition(String command, String kind) {
            this.command = command;
            this.kind = kind;
        }

        private TopicTransition opposite() {
            return this == CLOSE ? REOPEN : CLOSE;
        }
    }

    public record OutboundText(String id, String idempotencyKey, String conversationId, String text) {
    }

    private record TopicGeneration(Request request, Instant createdAt, Long firstMessageId) {
    }

    private record BlockingReopen(OperatorAction action, String status) {
    }

    private record SavedClientText(String id, String text, boolean application, boolean enrollment) {
        private String enrollmentId() {
            return enrollment ? id : null;
        }
    }

    public void saveUpdates(String source, List<IncomingUpdate> updates, String nextCursor, Instant now)
            throws SQLException {
        inbound.acceptBatch(source, updates.stream()
                .map(update -> new SqliteInboundEvents.Event(update.id(), update.payload(), now)).toList(), nextCursor);
    }

    public Optional<String> cursor(String source) throws SQLException {
        return inbound.cursor(source);
    }

    public Optional<PendingUpdate> pendingUpdate(String source) throws SQLException {
        return inbound.firstPending(source)
                .map(event -> new PendingUpdate(event.externalId(), event.payload(), event.retryAt()));
    }

    public void completeUpdate(String source, String eventId) throws SQLException {
        inbound.complete(source, eventId);
    }

    public void failUpdate(String source, String eventId, String reason, Instant retryAt, int maxAttempts)
            throws SQLException {
        inbound.fail(source, eventId, reason, retryAt, maxAttempts);
    }

    public ChannelIdentity claimChannelIdentity(String channel, String identity) throws SQLException {
        if (!Set.of("telegram", "vk").contains(channel) || identity.isBlank()) {
            throw new IllegalArgumentException("Invalid channel identity");
        }
        return SqliteDatabase.writeReturning(connection, () -> {
            var existing = SqliteChannelIdentity.find(connection, channel);
            if (identity.equals(existing)) {
                return ChannelIdentity.ACCEPTED;
            }
            var prefix = channel + ":%";
            try (var query = prepare("""
                    SELECT 1 FROM support_requests
                    WHERE channel = ? OR (? = 'telegram' AND operator_topic_id NOT LIKE 'web:%')
                    UNION ALL SELECT 1 FROM client_conversation_states WHERE channel = ?
                    UNION ALL SELECT 1 FROM inbound_events WHERE source LIKE ?
                    UNION ALL SELECT 1 FROM inbound_event_cursors WHERE source LIKE ?
                    UNION ALL SELECT 1 FROM processed_events
                      WHERE source LIKE ? OR source = ? OR source LIKE ?
                    UNION ALL SELECT 1 FROM operator_actions
                      WHERE ? = 'telegram' AND (operator_topic_id NOT LIKE 'web:%' OR kind = 'open_request')
                    LIMIT 1
                    """, channel, channel, channel, prefix, prefix, prefix, "client:" + channel,
                    "operator:" + channel + "%", channel); var rows = query.executeQuery()) {
                if (rows.next()) {
                    return existing == null ? ChannelIdentity.LEGACY_UNBOUND : ChannelIdentity.CONFLICT;
                }
            }
            execute("""
                    INSERT INTO channel_connection_identities (channel, identity) VALUES (?, ?)
                    ON CONFLICT (channel) DO UPDATE SET identity = excluded.identity
                    """, channel, identity);
            return ChannelIdentity.ACCEPTED;
        });
    }

    public boolean hasHandledClientText(String eventId) throws SQLException {
        return hasHandledClientText("telegram", eventId);
    }

    public boolean hasHandledClientText(String channel, String eventId) throws SQLException {
        return hasHandled("client:" + channel, eventId);
    }

    public ClientMenu.State menuState(String channel, String chat, boolean paused, Instant now) throws SQLException {
        return clientMenu.state(channel, chat, paused, now);
    }

    public boolean hasHandledMenuResponse(String channel, String eventId) throws SQLException {
        return hasHandled(channel + ":menu", eventId);
    }

    public boolean prepareMenuResponse(String channel, String chat, String eventId, ClientMenu.Response response,
            Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            if (hasHandled(channel + ":menu", eventId)) {
                return false;
            }
            clientMenu.save(channel, chat, eventId, response, now);
            return true;
        });
    }

    public void completeMenuResponse(String channel, String eventId, Instant now) throws SQLException {
        markHandled(channel + ":menu", eventId, now);
    }

    public String confirmEnrollment(String enrollmentId, String topicId, String operatorMessageId, Instant now)
            throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            Request request;
            String text;
            try (var query = prepare("""
                    SELECT request.*, message.enrollment_confirmation_text FROM conversation_messages AS message
                    JOIN support_requests AS request ON request.id = message.request_id
                    WHERE message.id = ? AND message.direction = 'client_to_operator'
                        AND message.enrollment_confirmation_text IS NOT NULL
                        AND request.status = 'active' AND request.operator_topic_id = ?
                        AND EXISTS (
                            SELECT 1 FROM message_links AS link
                            WHERE link.request_id = request.id AND link.direction = 'client_to_operator'
                                AND link.client_message_id = message.external_message_id AND link.operator_message_id = ?
                        )
                    """, enrollmentId, topicId, operatorMessageId); var rows = query.executeQuery()) {
                if (!rows.next()) {
                    return "unavailable";
                }
                request = request(rows);
                text = rows.getString("enrollment_confirmation_text");
            }
            var key = "enrollment:" + enrollmentId;
            try (var query = prepare("SELECT status FROM deliveries WHERE idempotency_key = ?", key);
                    var rows = query.executeQuery()) {
                if (rows.next()) {
                    return rows.getString("status");
                }
            }
            recordMessage(request.id(), "operator_to_client", operatorMessageId, null, text, now);
            usage("first-reply:" + request.id(), "first_reply", request, now);
            deliveries.enqueue(new SqliteDeliveryQueue.Delivery(UUID.randomUUID().toString(), request.id(), key,
                    operatorMessageId, request.channel(), request.chatId(), text, null, now));
            return "pending";
        });
    }

    public List<EnrollmentNotification> enrollmentNotifications(Instant now) throws SQLException {
        try (var query = prepare("""
                SELECT message.id, delivery.operator_message_id FROM conversation_messages AS message
                JOIN deliveries AS delivery ON delivery.idempotency_key = 'enrollment:' || message.id
                WHERE delivery.status = 'sent' AND message.enrollment_notified_at IS NULL
                    AND COALESCE(message.enrollment_notification_next_attempt_at, message.created_at) <= ?
                    AND delivery.operator_message_id IS NOT NULL
                LIMIT 25
                """, SqliteDatabase.timestamp(now)); var rows = query.executeQuery()) {
            var notifications = new ArrayList<EnrollmentNotification>();
            while (rows.next()) {
                notifications.add(new EnrollmentNotification(rows.getString("id"), rows.getString("operator_message_id")));
            }
            return List.copyOf(notifications);
        }
    }

    public void finishEnrollmentNotification(String enrollmentId, boolean sent, Instant now) throws SQLException {
        execute("""
                UPDATE conversation_messages SET enrollment_notified_at = ?, enrollment_notification_next_attempt_at = ?
                WHERE id = ?
                """, sent ? SqliteDatabase.timestamp(now) : null,
                sent ? null : SqliteDatabase.timestamp(now.plusSeconds(30)), enrollmentId);
    }

    public Optional<ClientRelay> stageClientText(ClientText text, Instant now) throws SQLException {
        return stageClientText(text, true, now);
    }

    private Optional<ClientRelay> stageClientText(ClientText text, boolean openTelegramTopic, Instant now)
            throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var intent = clientMenu.intent(text.channel(), text.chatId(), now).orElse(null);
            var previous = findRequest("""
                    SELECT * FROM support_requests WHERE channel = ? AND external_conversation_id = ?
                    ORDER BY (status = 'active') DESC, created_at DESC, rowid DESC LIMIT 1
                    """, text.channel(), text.chatId());
            if (previous.isPresent()) {
                var existing = previous.get();
                if ("active".equals(existing.status())) {
                    var saved = recordClientText(existing, text, intent);
                    var initial = isFirstClientMessage(existing.id(), text.messageId());
                    var opening = existing.topicId().startsWith("web:") && initial && hasTopicOpening(existing, text);
                    return Optional.of(new ClientRelay(existing, initial, opening,
                            opening ? previousTopic(existing) : null, saved.text(), saved.application(),
                            saved.enrollmentId()));
                }
                if (intent == null) {
                    return Optional.empty();
                }
                supersedePreviousActions(existing, now);
            }
            var id = UUID.randomUUID().toString();
            var request = new Request(id, text.channel(), text.chatId(), "web:" + id, "active");
            execute("""
                    INSERT INTO support_requests (id, channel, external_conversation_id, client_display_name,
                                                  operator_topic_id, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'active', ?)
                    """, id, text.channel(), text.chatId(), text.sender(), request.topicId(), SqliteDatabase.timestamp(now));
            var saved = recordClientText(request, text, intent);
            usage("new-request:" + id, "new_request", request, now);
            if (openTelegramTopic) {
                prepareOperatorAction(topicOpening(request, text), SqliteDatabase.timestamp(now));
            }
            return Optional.of(new ClientRelay(request, true, openTelegramTopic,
                    previous.map(Request::topicId).filter(topic -> !topic.startsWith("web:")).orElse(null),
                    saved.text(), saved.application(), saved.enrollmentId()));
        });
    }

    public void acceptClientTextInWeb(ClientText text, Instant now) throws SQLException {
        if (hasHandledClientText(text.channel(), text.eventId())) {
            return;
        }
        var relay = stageClientText(text, false, now);
        if (relay.isPresent()) {
            var recorded = relay.get();
            finishClientTextInWeb(recorded.request(), text, recorded.application(), true, now);
        }
    }

    public void finishClientText(Request request, ClientText text, boolean application, Instant now)
            throws SQLException {
        SqliteDatabase.writeTransaction(connection, () -> {
            enrollOrHandoffAcknowledgement(request, text, application, false, now);
            markHandled("client:" + request.channel(), text.eventId(), now);
        });
    }

    public void finishClientTextInWeb(Request request, ClientText text, boolean application,
            boolean recordRelay, Instant now) throws SQLException {
        SqliteDatabase.writeTransaction(connection, () -> {
            if (!request.topicId().startsWith("web:") && execute("""
                    UPDATE support_requests SET operator_topic_id = ?, web_owned_at = NULL
                    WHERE id = ? AND operator_topic_id = ? AND status = 'active'
                    """, "web:" + request.id(), request.id(), request.topicId()) != 1) {
                throw new SQLException("The operator surface changed before the web handoff");
            }
            usage("web-takeover:" + request.id(), "web_takeover", request, now);
            if (recordRelay) {
                execute("""
                        INSERT INTO message_links
                            (id, request_id, direction, client_message_id, operator_message_id, created_at)
                        VALUES (?, ?, 'client_to_operator', ?, ?, ?)
                        ON CONFLICT (id) DO NOTHING
                        """, "web-relay:" + request.id() + ":" + text.messageId(), request.id(), text.messageId(),
                        "web:" + request.channel() + ":" + text.messageId(), SqliteDatabase.timestamp(now));
            }
            enrollOrHandoffAcknowledgement(request, text, application, true, now);
            markHandled("client:" + request.channel(), text.eventId(), now);
        });
    }

    private void enqueueAcknowledgement(Request request, String acknowledgementKind, String text, Instant now)
            throws SQLException {
        var key = "system:handoff-" + acknowledgementKind + ":" + request.id();
        deliveries.enqueue(new SqliteDeliveryQueue.Delivery(key, request.id(), key, key,
                request.channel(), request.chatId(), text, null, now));
    }

    private void enrollOrHandoffAcknowledgement(Request request, ClientText client, boolean application,
            boolean delayed, Instant now) throws SQLException {
        var kind = delayed ? "delayed" : "ack";
        if (!application) {
            enqueueAcknowledgement(request, kind,
                    delayed ? ClientMessages.HANDOFF_DELAYED : ClientMessages.HANDOFF_SENT, now);
            return;
        }
        var key = "system:application-" + kind + ":" + request.id() + ":" + client.messageId();
        deliveries.enqueue(new SqliteDeliveryQueue.Delivery(key, request.id(), key, key, request.channel(),
                request.chatId(), delayed ? ClientMessages.APPLICATION_DELAYED : ClientMessages.APPLICATION_SENT, null, now));
    }

    public boolean queueOperatorReply(String eventId, String topicId, String messageId, String text,
            Instant receivedAt, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            if (hasHandled(OPERATOR_SOURCE, eventId)) {
                return true;
            }

            var target = bindOperatorEvent(eventId, topicId, messageId, receivedAt);
            if (target.isEmpty()) {
                return false;
            }
            var request = target.get();
            if (!topicId.equals(request.topicId()) || !"active".equals(request.status())) {
                return false;
            }
            enqueueOperatorReply(request, OPERATOR_SOURCE, eventId, messageId, text, receivedAt, now);
            return true;
        });
    }

    public WebActionResult replyFromWeb(String requestId, String idempotencyKey, String text, Instant now)
            throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var target = findWebRequest(requestId);
            if (target.isEmpty()) {
                return WebActionResult.NOT_FOUND;
            }
            var request = target.get();
            if (!"active".equals(request.status())) {
                return WebActionResult.CLOSED;
            }
            var eventId = "reply:" + requestId + ":" + idempotencyKey;
            if (!hasHandled(WEB_SOURCE, eventId)) {
                markWebOwned(request, now);
                enqueueOperatorReply(request, WEB_SOURCE, eventId, "web:" + eventId, text, now, now);
            }
            return WebActionResult.ACCEPTED;
        });
    }

    public WebActionResult closeFromWeb(String requestId, String idempotencyKey, Instant now)
            throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var target = findWebRequest(requestId);
            if (target.isEmpty()) {
                return WebActionResult.NOT_FOUND;
            }
            var request = target.get();
            var eventId = "close:" + requestId + ":" + idempotencyKey;
            if ("active".equals(request.status()) && !hasHandled(WEB_SOURCE, eventId)) {
                markWebOwned(request, now);
                applyTransition(request.id(), request.topicId(), TopicTransition.CLOSE, now);
                markHandled(WEB_SOURCE, eventId, now);
            }
            return WebActionResult.ACCEPTED;
        });
    }

    private Optional<Request> findWebRequest(String id) throws SQLException {
        return findRequest("""
                SELECT * FROM support_requests WHERE id = ? AND operator_topic_id GLOB 'web:*'
                """, id);
    }

    private void markWebOwned(Request request, Instant now) throws SQLException {
        if (execute("""
                UPDATE support_requests SET web_owned_at = COALESCE(web_owned_at, ?)
                WHERE id = ? AND operator_topic_id = ? AND status = 'active'
                """, SqliteDatabase.timestamp(now), request.id(), request.topicId()) != 1) {
            throw new SQLException("Web operator request ownership changed");
        }
    }

    private void enqueueOperatorReply(Request request, String source, String eventId, String messageId,
            String text, Instant receivedAt, Instant now) throws SQLException {
        usage("first-reply:" + request.id(), "first_reply", request, now);
        recordMessage(request.id(), "operator_to_client", messageId, null, text, receivedAt);
        deliveries.enqueue(new SqliteDeliveryQueue.Delivery(UUID.randomUUID().toString(), request.id(),
                "operator:" + eventId, messageId, request.channel(), request.chatId(), text, null, now));
        markHandled(source, eventId, now);
    }

    public Optional<Request> recordVkOperatorText(NativeOperatorText text, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            if (hasHandled(VK_NATIVE_SOURCE, text.eventId())) {
                return Optional.empty();
            }
            var target = findRequest("""
                    SELECT request.* FROM support_requests AS request
                    JOIN conversation_messages AS message ON message.request_id = request.id
                    WHERE request.channel = 'vk' AND request.external_conversation_id = ?
                        AND message.direction = 'operator_to_client' AND message.external_message_id = ?
                    ORDER BY message.rowid LIMIT 1
                    """, text.chatId(), text.messageId());
            if (target.isEmpty()) {
                target = findRequest("""
                        SELECT request.* FROM support_requests AS request
                        WHERE request.channel = 'vk' AND request.external_conversation_id = ? AND request.status = 'active'
                            AND EXISTS (SELECT 1 FROM conversation_messages AS message
                                WHERE message.request_id = request.id AND message.direction = 'client_to_operator'
                                    AND message.created_at <= ?)
                        """, text.chatId(), SqliteDatabase.timestamp(text.receivedAt()));
            }
            if (target.isEmpty()) {
                completeVkOperatorText(text.eventId(), now);
                return Optional.empty();
            }
            var request = target.get();
            usage("first-reply:" + request.id(), "first_reply", request, now);
            recordMessage(request.id(), "operator_to_client", text.messageId(), null, text.text(), text.receivedAt());
            return Optional.of(request);
        });
    }

    public void completeVkOperatorText(String eventId, Instant now) throws SQLException {
        markHandled(VK_NATIVE_SOURCE, eventId, now);
    }

    public boolean canMirrorNativeReply(Request request) throws SQLException {
        return findRequest("""
                SELECT * FROM support_requests WHERE id = ? AND operator_topic_id = ? AND status = 'active'
                """, request.id(), request.topicId()).isPresent() && isCurrent(request);
    }

    public Optional<ClientHistory> firstClientMessage(Request request) throws SQLException {
        try (var query = prepare("""
                SELECT message.external_message_id, message.text, message.id, message.enrollment_confirmation_text,
                    COALESCE(NULLIF(message.sender_name, ''), NULLIF(request.client_display_name, ''), 'Клиент') AS sender
                FROM conversation_messages AS message JOIN support_requests AS request ON request.id = message.request_id
                WHERE message.request_id = ? AND message.direction = 'client_to_operator'
                ORDER BY message.created_at, message.rowid LIMIT 1
                """, request.id()); var rows = query.executeQuery()) {
            return rows.next() ? Optional.of(clientHistory(rows)) : Optional.empty();
        }
    }

    public List<Request> recoverableWebRequests() throws SQLException {
        var requests = new ArrayList<Request>();
        try (var query = prepare("""
                SELECT request.* FROM support_requests AS request
                WHERE request.operator_topic_id GLOB 'web:*' AND request.status = 'active' AND request.web_owned_at IS NULL
                    AND EXISTS (SELECT 1 FROM conversation_messages AS message WHERE message.request_id = request.id
                        AND message.direction = 'client_to_operator' AND message.processing_state = 'accepted')
                    AND NOT EXISTS (SELECT 1 FROM operator_actions AS action WHERE action.request_id = request.id
                        AND action.kind IN ('open_request', 'relay_message')
                        AND (action.status IN ('sending', 'outcome_unknown') OR
                            (action.status = 'pending' AND action.id GLOB 'operator-open:*')))
                ORDER BY request.created_at, request.id LIMIT 50
                """); var rows = query.executeQuery()) {
            while (rows.next()) {
                requests.add(new Request(rows.getString("id"), rows.getString("channel"),
                        rows.getString("external_conversation_id"), rows.getString("operator_topic_id"), rows.getString("status")));
            }
        }
        return requests;
    }

    public WebRecovery prepareWebRecovery(Request request) throws SQLException {
        var messages = new ArrayList<ClientHistory>();
        String applicationMessage = null;
        try (var query = prepare("""
                SELECT message.external_message_id, message.text, message.id, message.application_label,
                    message.enrollment_confirmation_text, COALESCE(NULLIF(message.sender_name, ''),
                        NULLIF(request.client_display_name, ''), 'Клиент') AS sender
                FROM conversation_messages AS message JOIN support_requests AS request ON request.id = message.request_id
                WHERE message.request_id = ? AND message.direction = 'client_to_operator' AND message.processing_state = 'accepted'
                ORDER BY message.created_at, message.rowid
                """, request.id()); var rows = query.executeQuery()) {
            while (rows.next()) {
                if (messages.isEmpty() && rows.getString("application_label") != null) {
                    applicationMessage = rows.getString("external_message_id");
                }
                messages.add(clientHistory(rows));
            }
        }
        var opening = findOperatorAction("""
                SELECT * FROM operator_actions WHERE request_id = ? AND kind = 'open_request'
                    AND id GLOB 'operator-open-recovery:*' AND status <> 'abandoned'
                ORDER BY rowid DESC LIMIT 1
                """, request.id()).orElseGet(() -> recoveryOpening(request, messages.getFirst().messageId(), null));
        return new WebRecovery(request, List.copyOf(messages), applicationMessage, previousTopic(request), opening);
    }

    public static OperatorAction recoveryOpening(Request request, String firstMessage, String unavailableTopic) {
        return new OperatorAction("operator-open-recovery:" + request.id()
                + (unavailableTopic == null ? "" : ":" + unavailableTopic),
                request.id(), "open_request", firstMessage, request.topicId(), 0, true);
    }

    public boolean finishWebRecovery(WebRecovery recovery, String topic, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var request = recovery.request();
            if (execute("""
                    UPDATE support_requests SET operator_topic_id = ?
                    WHERE id = ? AND operator_topic_id = ? AND status = 'active' AND web_owned_at IS NULL
                    """, topic, request.id(), request.topicId()) != 1) {
                return false;
            }
            var application = recovery.applicationMessageId();
            if (application == null) {
                enqueueAcknowledgement(request, "recovered", ClientMessages.HANDOFF_SENT, now);
            } else {
                var key = "system:application-recovered:" + request.id() + ":" + application;
                deliveries.enqueue(new SqliteDeliveryQueue.Delivery(key, request.id(), key, key, request.channel(),
                        request.chatId(), ClientMessages.APPLICATION_SENT, null, now));
            }
            return true;
        });
    }

    public Optional<List<ClientHistory>> replacementHistory(Request request) throws SQLException {
        String started;
        try (var query = prepare("""
                SELECT replacement.created_at, EXISTS (
                    SELECT 1 FROM operator_actions AS mirror
                    WHERE mirror.request_id = replacement.request_id AND mirror.operator_topic_id = replacement.external_result_id
                        AND mirror.kind = 'mirror_operator_message' AND mirror.id LIKE ?
                ) AS history_complete FROM operator_actions AS replacement
                WHERE replacement.request_id = ? AND replacement.id LIKE 'operator-open-replacement:%'
                    AND replacement.kind = 'open_request' AND replacement.status = 'sent' AND replacement.external_result_id = ?
                ORDER BY replacement.created_at DESC, replacement.rowid DESC LIMIT 1
                """, "operator-mirror:" + request.id() + ":replacement:" + request.topicId() + ":%",
                request.id(), request.topicId()); var rows = query.executeQuery()) {
            if (!rows.next()) {
                return Optional.empty();
            }
            // Scoped mirror actions are prepared after all client messages have been restored.
            if (rows.getBoolean("history_complete")) {
                return Optional.of(List.of());
            }
            started = rows.getString("created_at");
        }
        try (var query = prepare("""
                SELECT message.external_message_id, message.text, message.id, message.enrollment_confirmation_text,
                    COALESCE(NULLIF(message.sender_name, ''), NULLIF(request.client_display_name, ''), 'Клиент') AS sender
                FROM conversation_messages AS message
                JOIN support_requests AS request ON request.id = message.request_id
                WHERE message.request_id = ? AND message.direction = 'client_to_operator' AND message.created_at <= ?
                ORDER BY message.created_at, message.rowid
                """, request.id(), started); var rows = query.executeQuery()) {
            var history = new ArrayList<ClientHistory>();
            while (rows.next()) {
                history.add(clientHistory(rows));
            }
            return Optional.of(List.copyOf(history));
        }
    }

    private static ClientHistory clientHistory(java.sql.ResultSet row) throws SQLException {
        return new ClientHistory(row.getString("external_message_id"), row.getString("sender"), row.getString("text"),
                row.getString("enrollment_confirmation_text") == null ? null : row.getString("id"));
    }

    public Optional<OperatorAction> prepareTopicCommand(String eventId, String topicId, String messageId,
            Instant receivedAt, TopicTransition transition, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            if (hasHandled(OPERATOR_SOURCE, eventId)) {
                return Optional.empty();
            }
            var request = bindOperatorEvent(eventId, topicId, messageId, receivedAt);
            if (request.isEmpty() || !topicId.equals(request.get().topicId()) || !isCurrent(request.get())) {
                markHandled(OPERATOR_SOURCE, eventId, now);
                return Optional.empty();
            }
            var action = topicCommand(request.get(), eventId, transition);
            prepareOperatorAction(action, SqliteDatabase.timestamp(now));
            return Optional.of(action);
        });
    }

    public Optional<HeldReply> holdOperatorReply(String eventId, String topicId, String messageId, String text,
            Instant receivedAt, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var target = bindOperatorEvent(eventId, topicId, messageId, receivedAt);
            if (target.isEmpty() || !topicId.equals(target.get().topicId())
                    || !"closed".equals(target.get().status()) || !isCurrent(target.get())) {
                return Optional.empty();
            }
            var request = target.get();
            var requested = topicCommand(request, eventId, TopicTransition.REOPEN);
            var blocking = blockingReopen(request);
            var action = blocking.map(BlockingReopen::action).orElse(requested);
            if (blocking.isEmpty()) {
                prepareOperatorAction(action, SqliteDatabase.timestamp(now));
            }
            execute("""
                    INSERT INTO conversation_messages (
                        id, request_id, direction, external_message_id, text, created_at, processing_state,
                        event_source, external_event_id, prerequisite_action_id, held_sequence
                    ) VALUES (?, ?, 'operator_to_client', ?, ?, ?, 'held', ?, ?, ?, (
                        SELECT COALESCE(MAX(held_sequence), -1) + 1 FROM conversation_messages WHERE request_id = ?
                    )) ON CONFLICT DO NOTHING
                    """, "held-operator-message:" + OPERATOR_SOURCE + ":" + eventId, request.id(), messageId,
                    text, SqliteDatabase.timestamp(receivedAt), OPERATOR_SOURCE, eventId, action.id(), request.id());
            var canResume = blocking.filter(existing -> action.id().equals(requested.id())
                    && ("pending".equals(existing.status()) || "failed".equals(existing.status()))).isPresent();
            return Optional.of(new HeldReply(action, blocking.isEmpty() || canResume));
        });
    }

    public void finishTopicCommand(String eventId, Instant now) throws SQLException {
        markHandled(OPERATOR_SOURCE, eventId, now);
    }

    public void observeTopicTransition(String eventId, String topicId, String messageId, Instant occurredAt,
            TopicTransition transition) throws SQLException {
        SqliteDatabase.writeTransaction(connection, () -> {
            if (hasHandled(OPERATOR_SOURCE, eventId)) {
                return;
            }
            var request = bindOperatorEvent(eventId, topicId, messageId, occurredAt);
            if (request.isPresent() && topicId.equals(request.get().topicId()) && isCurrent(request.get())) {
                applyTransition(request.get().id(), topicId, transition, occurredAt);
                var timestamp = SqliteDatabase.timestamp(occurredAt);
                execute("""
                        UPDATE operator_actions SET status = 'sent', external_result_id = ?, last_error = NULL,
                            completed_at = ?, resolved_at = ?, attempt_started_at = NULL
                        WHERE request_id = ? AND operator_topic_id = ? AND kind = ? AND status = 'outcome_unknown'
                        """, topicId, timestamp, timestamp, request.get().id(), topicId, transition.kind);
                execute("""
                        UPDATE operator_actions SET status = 'abandoned', resolved_at = ?,
                            manual_resolution = 'confirmed_not_completed', attempt_started_at = NULL
                        WHERE request_id = ? AND operator_topic_id = ? AND kind = ? AND status = 'outcome_unknown'
                        """, timestamp, request.get().id(), topicId, transition.opposite().kind);
            }
            markHandled(OPERATOR_SOURCE, eventId, occurredAt);
        });
    }

    private static OperatorAction topicCommand(Request request, String eventId, TopicTransition transition) {
        var id = "operator-" + transition.command + ":" + request.id() + ":" + eventId;
        return new OperatorAction(id, request.id(), transition.kind, eventId, request.topicId(), 0, false);
    }

    private Optional<BlockingReopen> blockingReopen(Request request) throws SQLException {
        try (var query = prepare("""
                SELECT action.id, action.client_message_id, action.status FROM operator_actions AS action
                WHERE action.request_id = ? AND action.operator_topic_id = ? AND action.kind = 'reopen_request'
                    AND (action.status IN ('pending', 'sending', 'outcome_unknown') OR (
                        (action.status = 'failed' OR
                            (action.status = 'abandoned' AND action.manual_resolution = 'confirmed_not_completed'))
                        AND EXISTS (
                            SELECT 1 FROM conversation_messages AS held
                            WHERE held.prerequisite_action_id = action.id AND held.processing_state = 'held'
                        )
                    ))
                ORDER BY action.created_at DESC, action.rowid DESC LIMIT 1
                """, request.id(), request.topicId()); var rows = query.executeQuery()) {
            if (!rows.next()) {
                return Optional.empty();
            }
            var action = new OperatorAction(rows.getString("id"), request.id(), "reopen_request",
                    rows.getString("client_message_id"), request.topicId(), 0, false);
            return Optional.of(new BlockingReopen(action, rows.getString("status")));
        }
    }

    public void prepareRelayActions(List<OperatorAction> actions, Instant now) throws SQLException {
        var timestamp = SqliteDatabase.timestamp(now);
        SqliteDatabase.writeTransaction(connection, () -> {
            for (var action : actions) {
                prepareOperatorAction(action, timestamp);
            }
        });
    }

    public Optional<OperatorAction> findRetryableHeldReopen(String id) throws SQLException {
        var candidate = findOperatorAction("""
                SELECT action.* FROM operator_actions AS action
                JOIN support_requests AS request ON request.id = action.request_id
                WHERE action.id = ? AND action.kind = 'reopen_request' AND (
                    action.status = 'failed'
                    OR (action.status = 'abandoned' AND action.manual_resolution = 'confirmed_not_completed')
                ) AND request.status = 'closed' AND request.operator_topic_id = action.operator_topic_id
                    AND EXISTS (
                        SELECT 1 FROM conversation_messages AS held
                        WHERE held.prerequisite_action_id = action.id AND held.processing_state = 'held'
                    )
                """, id);
        if (candidate.isEmpty()) {
            return Optional.empty();
        }
        var request = findRequest("SELECT * FROM support_requests WHERE id = ?", candidate.get().requestId());
        return request.isPresent() && isCurrent(request.get()) ? candidate : Optional.empty();
    }

    public ClaimedAction claimOperatorAction(OperatorAction action, Instant now) throws SQLException {
        var timestamp = SqliteDatabase.timestamp(now);
        prepareOperatorAction(action, timestamp);
        try (var query = prepare("""
                SELECT status, external_result_id, manual_resolution FROM operator_actions
                WHERE id = ? AND request_id = ? AND kind = ? AND client_message_id = ? AND operator_topic_id = ?
                    AND sequence = ?
                """, action.id(), action.requestId(), action.kind(), action.clientMessageId(), action.topicId(),
                action.sequence()); var rows = query.executeQuery()) {
            if (!rows.next()) {
                throw new SQLException("Operator action identity collision");
            }
            var status = rows.getString("status");
            var result = rows.getString("external_result_id");
            var confirmedNotCompleted = "reopen_request".equals(action.kind()) && "abandoned".equals(status)
                    && "confirmed_not_completed".equals(rows.getString("manual_resolution"));
            if (!"pending".equals(status) && !"failed".equals(status) && !confirmedNotCompleted) {
                return new ClaimedAction(status, result);
            }
        }
        var updated = execute("""
                UPDATE operator_actions SET status = 'sending', attempt_started_at = ?,
                    manual_resolution = NULL, resolved_at = NULL
                WHERE id = ? AND (status IN ('pending', 'failed') OR (
                    kind = 'reopen_request' AND status = 'abandoned' AND manual_resolution = 'confirmed_not_completed'
                ))
                """, timestamp, action.id());
        return new ClaimedAction(updated == 1 ? "claimed" : "sending", null);
    }

    public void completeOperatorAction(OperatorAction action, String result, Instant now) throws SQLException {
        var timestamp = SqliteDatabase.timestamp(now);
        SqliteDatabase.writeTransaction(connection, () -> {
            if ("open_request".equals(action.kind()) && action.id().startsWith("operator-open-recovery:")) {
                // The web request stays available until all client messages are transferred.
            } else if ("open_request".equals(action.kind())) {
                var switched = execute("""
                        UPDATE support_requests SET operator_topic_id = ?
                        WHERE id = ? AND operator_topic_id = ? AND status = 'active' AND web_owned_at IS NULL
                        """, result, action.requestId(), action.topicId());
                if (switched != 1) {
                    throw new SQLException("The operator surface changed concurrently");
                }
            } else if ("relay_message".equals(action.kind())) {
                execute("""
                        INSERT INTO message_links
                            (id, request_id, direction, client_message_id, operator_message_id, created_at)
                        VALUES (?, ?, 'client_to_operator', ?, ?, ?)
                        """, "operator-action-link:" + action.id(), action.requestId(), action.clientMessageId(),
                        result, timestamp);
            } else if ("close_request".equals(action.kind()) && action.id().startsWith("operator-close-recovery:")) {
                // This topic was never assigned to the request.
            } else if ("close_request".equals(action.kind())) {
                applyTransition(action.requestId(), action.topicId(), TopicTransition.CLOSE, now);
            } else if ("reopen_request".equals(action.kind())) {
                applyTransition(action.requestId(), action.topicId(), TopicTransition.REOPEN, now);
            } else if (!"mirror_operator_message".equals(action.kind())) {
                throw new SQLException("Unsupported operator action kind");
            }
            var updated = execute("""
                    UPDATE operator_actions SET status = 'sent', external_result_id = ?, last_error = NULL,
                        completed_at = ?, attempt_started_at = NULL
                    WHERE id = ? AND status = 'sending'
                    """, result, timestamp, action.id());
            if (updated != 1) {
                throw new SQLException("Claimed operator action was not found");
            }
        });
    }

    public void failOperatorAction(String id, String reason, boolean uncertain) throws SQLException {
        execute("""
                UPDATE operator_actions SET status = ?, last_error = ?, attempt_started_at = NULL
                WHERE id = ? AND status = 'sending'
                """, uncertain ? "outcome_unknown" : "failed", reason, id);
    }

    public List<OutboundText> pendingTelegramDeliveries(Instant now) throws SQLException {
        return pendingDeliveries("telegram", now);
    }

    public List<OutboundText> pendingDeliveries(String channel, Instant now) throws SQLException {
        return deliveries.findPending(now, 25, Set.of(channel)).stream()
                .map(delivery -> new OutboundText(delivery.id(), delivery.idempotencyKey(), delivery.conversationId(),
                        delivery.text())).toList();
    }

    public boolean claimDelivery(String id, Instant now) throws SQLException {
        return deliveries.claim(id, now);
    }

    public boolean confirmDeliveryReceived(String id, Instant now) throws SQLException {
        return deliveries.confirmUnknownReceived(id, now);
    }

    public boolean resolveTopicAction(String id, boolean completed, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var incident = lifecycleIncident(id);
            if (incident.isEmpty()) {
                return false;
            }
            var action = incident.get();
            if (completed && !action.id().startsWith("operator-close-recovery:")) {
                var request = findRequest("SELECT * FROM support_requests WHERE id = ?", action.requestId());
                if (request.isEmpty() || !action.topicId().equals(request.get().topicId())
                        || !isCurrent(request.get())) {
                    return false;
                }
                applyTransition(action.requestId(), action.topicId(),
                        "close_request".equals(action.kind()) ? TopicTransition.CLOSE : TopicTransition.REOPEN, now);
            }
            var timestamp = SqliteDatabase.timestamp(now);
            return execute("""
                    UPDATE operator_actions SET status = ?, last_error = NULL, attempt_started_at = NULL,
                        external_result_id = CASE WHEN ? THEN operator_topic_id ELSE external_result_id END,
                        completed_at = CASE WHEN ? THEN ? ELSE completed_at END,
                        manual_resolution = ?, resolved_at = ?
                    WHERE id = ? AND status = 'outcome_unknown'
                    """, completed ? "sent" : "abandoned", completed ? 1 : 0, completed ? 1 : 0, timestamp,
                    completed ? "confirmed_completed" : "confirmed_not_completed", timestamp, id) == 1;
        });
    }

    public boolean confirmOperatorRelayReceived(String id, String acknowledgement, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var incident = findOperatorAction("""
                    SELECT * FROM operator_actions WHERE id = ? AND status = 'outcome_unknown'
                        AND kind IN ('relay_message', 'mirror_operator_message')
                    """, id);
            if (incident.isEmpty()) {
                return false;
            }
            var action = incident.get();
            var timestamp = SqliteDatabase.timestamp(now);
            var updated = execute("""
                    UPDATE operator_actions SET status = 'sent', last_error = NULL, completed_at = ?,
                        manual_resolution = 'confirmed_received', resolved_at = ?, attempt_started_at = NULL
                    WHERE id = ? AND status = 'outcome_unknown' AND NOT EXISTS (
                        SELECT 1 FROM operator_actions AS blocking
                        WHERE blocking.request_id = operator_actions.request_id
                            AND blocking.client_message_id = operator_actions.client_message_id
                            AND blocking.id != operator_actions.id
                            AND blocking.status IN ('pending', 'sending', 'failed')
                    )
                    """, timestamp, timestamp, id);
            if (updated != 1) {
                return false;
            }
            if (action.initial() && findOperatorAction("""
                    SELECT * FROM operator_actions WHERE request_id = ? AND client_message_id = ?
                        AND status = 'outcome_unknown' LIMIT 1
                    """, action.requestId(), action.clientMessageId()).isEmpty()) {
                var request = findRequest("SELECT * FROM support_requests WHERE id = ?", action.requestId())
                        .orElseThrow(() -> new SQLException("Operator action request is missing"));
                enqueueAcknowledgement(request, "ack", acknowledgement, now);
            }
            return true;
        });
    }

    public boolean moveOperatorIncidentToWeb(String id, String acknowledgement, Instant now) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            var incident = findOperatorAction("""
                    SELECT action.* FROM operator_actions AS action WHERE action.id = ? AND (
                        (action.kind IN ('open_request', 'relay_message') AND action.status = 'outcome_unknown') OR
                        (action.kind = 'reopen_request' AND action.status IN ('failed', 'abandoned') AND EXISTS (
                            SELECT 1 FROM conversation_messages AS held
                            WHERE held.prerequisite_action_id = action.id AND held.processing_state = 'held'
                        ))
                    )
                    """, id);
            if (incident.isEmpty()) {
                return false;
            }
            var action = incident.get();
            var target = findRequest("SELECT * FROM support_requests WHERE id = ?", action.requestId());
            if (target.isEmpty()) {
                return false;
            }
            var request = target.get();
            var webTopic = "web:" + request.id();
            var timestamp = SqliteDatabase.timestamp(now);
            if ("reopen_request".equals(action.kind())) {
                if (!"closed".equals(request.status())
                        || !SqliteStartupRecovery.reactivateRequest(connection, request.id(), action.topicId())) {
                    return false;
                }
                execute("""
                        UPDATE support_requests SET operator_topic_id = ?, web_owned_at = ? WHERE id = ?
                        """, webTopic, timestamp, request.id());
                SqliteStartupRecovery.releaseHeldReplies(connection, request.id(), now);
                execute("""
                        UPDATE operator_actions SET status = 'abandoned', last_error = NULL,
                            manual_resolution = 'use_web', resolved_at = ?, attempt_started_at = NULL WHERE id = ?
                        """, timestamp, id);
            } else {
                if (!"active".equals(request.status())
                        || (!request.topicId().equals(webTopic) && !request.topicId().equals(action.topicId()))) {
                    return false;
                }
                if (action.id().startsWith("operator-open-recovery:") || action.id().contains(":recovery:")) {
                    execute("""
                            UPDATE support_requests SET operator_topic_id = ?, web_owned_at = ? WHERE id = ?
                            """, webTopic, timestamp, request.id());
                } else if (!request.topicId().equals(webTopic)) {
                    execute("""
                            UPDATE support_requests SET operator_topic_id = ?, web_owned_at = NULL WHERE id = ?
                            """, webTopic, request.id());
                }
                execute("""
                        UPDATE operator_actions SET status = 'abandoned', last_error = NULL,
                            manual_resolution = 'use_web', resolved_at = ?, attempt_started_at = NULL
                        WHERE request_id = ? AND client_message_id = ? AND status = 'outcome_unknown'
                        """, timestamp, request.id(), action.clientMessageId());
                if (action.initial()) {
                    enqueueAcknowledgement(request, "delayed", acknowledgement, now);
                }
            }
            usage("web-takeover:" + request.id(), "web_takeover", request, now);
            return true;
        });
    }

    private Optional<OperatorAction> lifecycleIncident(String actionId) throws SQLException {
        return findOperatorAction("""
                SELECT * FROM operator_actions WHERE id = ? AND status = 'outcome_unknown'
                    AND kind IN ('close_request', 'reopen_request')
                """, actionId);
    }

    private Optional<OperatorAction> findOperatorAction(String sql, Object... args) throws SQLException {
        try (var query = prepare(sql, args); var rows = query.executeQuery()) {
            if (!rows.next()) {
                return Optional.empty();
            }
            return Optional.of(new OperatorAction(rows.getString("id"), rows.getString("request_id"),
                    rows.getString("kind"), rows.getString("client_message_id"), rows.getString("operator_topic_id"),
                    rows.getInt("sequence"), rows.getInt("initial") == 1));
        }
    }

    public boolean confirmDeliveryNotReceived(String id, Instant now) throws SQLException {
        return deliveries.retryFailed(id, true, now);
    }

    public boolean retryFailedDelivery(String id, Instant now) throws SQLException {
        return deliveries.retryFailed(id, false, now);
    }

    public boolean resolveInboundEvent(String source, String id, boolean retry) throws SQLException {
        return inbound.resolve(source, id, retry);
    }

    public List<DeliveryNotification> deliveryNotifications(Instant now) throws SQLException {
        var result = new ArrayList<DeliveryNotification>();
        try (var query = prepare("""
                SELECT delivery.id, delivery.channel, request.operator_topic_id, delivery.operator_message_id,
                    delivery.outcome_unknown FROM deliveries AS delivery JOIN support_requests AS request ON request.id = delivery.request_id
                WHERE delivery.status = 'failed' AND delivery.operator_notified_at IS NULL
                    AND COALESCE(delivery.notification_next_attempt_at, delivery.created_at) <= ?
                    AND request.operator_topic_id NOT GLOB 'web:*'
                ORDER BY delivery.created_at, delivery.id LIMIT 10
                """, SqliteDatabase.timestamp(now)); var rows = query.executeQuery()) {
            while (rows.next()) {
                result.add(new DeliveryNotification(rows.getString("id"), rows.getString("channel"),
                        rows.getString("operator_topic_id"), rows.getString("operator_message_id"), rows.getBoolean("outcome_unknown")));
            }
        }
        return result;
    }

    public void finishDeliveryNotification(String id, boolean sent, Instant now) throws SQLException {
        execute("""
                UPDATE deliveries SET operator_notified_at = ?, notification_next_attempt_at = ?
                WHERE id = ? AND status = 'failed' AND operator_notified_at IS NULL
                """, sent ? SqliteDatabase.timestamp(now) : null,
                sent ? null : SqliteDatabase.timestamp(now.plusSeconds(30)), id);
    }

    public SqliteRetention.Result purgeClosedConversationContent(Instant closedBefore) throws SQLException {
        return SqliteRetention.purge(connection, closedBefore);
    }

    public void completeDelivery(String id, String externalMessageId, Instant now) throws SQLException {
        deliveries.complete(id, externalMessageId, UUID.randomUUID().toString(), now);
    }

    public void failDelivery(String id, String reason, boolean uncertain, Instant now) throws SQLException {
        SqliteDatabase.writeTransaction(connection, () -> {
            int attempts;
            try (var query = prepare("""
                    SELECT attempts FROM deliveries WHERE id = ? AND status = 'pending'
                        AND attempt_started_at IS NOT NULL
                    """, id); var rows = query.executeQuery()) {
                if (!rows.next()) {
                    return;
                }
                attempts = rows.getInt("attempts");
            }
            var finalFailure = uncertain || attempts >= 4;
            var retryAt = finalFailure ? null : SqliteDatabase.timestamp(now.plusSeconds(5L << attempts));
            execute("""
                    UPDATE deliveries SET status = ?, attempts = attempts + 1, last_error = ?,
                        outcome_unknown = ?, next_attempt_at = ?, attempt_started_at = NULL
                    WHERE id = ?
                    """, finalFailure ? "failed" : "pending", reason, uncertain ? 1 : 0, retryAt, id);
            if (finalFailure) {
                execute("""
                        INSERT OR IGNORE INTO usage_events (id, event_type, channel, request_id, occurred_at)
                        SELECT ?, 'delivery_failure', channel, request_id, ? FROM deliveries WHERE id = ?
                        """, "delivery-failure:" + id, SqliteDatabase.timestamp(now), id);
            }
        });
    }

    @Override
    public void close() throws SQLException {
        connection.close();
    }

    public static OperatorAction topicOpening(Request request, ClientText text) {
        return new OperatorAction("operator-open:" + request.id(), request.id(), "open_request",
                text.messageId(), request.topicId(), 0, true);
    }

    private SavedClientText recordClientText(Request request, ClientText client, ClientMenu.Intent intent)
            throws SQLException {
        try (var query = prepare("""
                SELECT id, text, application_label, enrollment_confirmation_text FROM conversation_messages
                WHERE request_id = ? AND direction = 'client_to_operator' AND external_message_id = ?
                """, request.id(), client.messageId()); var rows = query.executeQuery()) {
            if (rows.next()) {
                return new SavedClientText(rows.getString("id"), rows.getString("text"),
                        rows.getString("application_label") != null, rows.getString("enrollment_confirmation_text") != null);
            }
        }
        var label = intent == null ? null : intent.applicationLabel();
        var question = intent == null ? null : intent.questionContext();
        var confirmation = intent == null ? null : intent.enrollmentConfirmation();
        var message = client.text();
        if (question != null) {
            message = "Вопрос о группе: " + question + "\n\n" + message;
        } else if (label != null) {
            message = (confirmation == null ? "Заявка: " : "Запись на занятие: ") + label + "\n\n" + message;
        }
        var id = UUID.randomUUID().toString();
        execute("""
                INSERT INTO conversation_messages (id, request_id, direction, external_message_id, sender_name,
                    text, created_at, application_label, question_context, enrollment_confirmation_text)
                VALUES (?, ?, 'client_to_operator', ?, ?, ?, ?, ?, ?, ?)
                """, id, request.id(), client.messageId(), client.sender(), message,
                SqliteDatabase.timestamp(client.receivedAt()), label, question, confirmation);
        if (label != null) {
            execute("""
                    INSERT INTO usage_events (id, event_type, channel, request_id, action_key, action_label, occurred_at)
                    VALUES (?, 'menu_action', ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING
                    """, "application:" + request.id() + ":" + client.messageId(), request.channel(), request.id(),
                    "application:" + label, "Заявка отправлена: " + label, SqliteDatabase.timestamp(client.receivedAt()));
        }
        if (intent != null) {
            clientMenu.clearIntent(request.channel(), request.chatId());
        }
        return new SavedClientText(id, message, label != null, confirmation != null);
    }

    private String previousTopic(Request request) throws SQLException {
        return findRequest("""
                SELECT * FROM support_requests
                WHERE channel = ? AND external_conversation_id = ? AND id != ? AND status = 'closed'
                ORDER BY created_at DESC, rowid DESC LIMIT 1
                """, request.channel(), request.chatId(), request.id())
                .map(Request::topicId).filter(topic -> !topic.startsWith("web:")).orElse(null);
    }

    private void supersedePreviousActions(Request request, Instant now) throws SQLException {
        execute("""
                UPDATE operator_actions SET status = 'superseded', attempt_started_at = NULL,
                    manual_resolution = NULL, resolved_at = ?
                WHERE request_id IN (
                    SELECT id FROM support_requests WHERE channel = ? AND external_conversation_id = ?
                        AND status = 'closed'
                ) AND kind != 'mirror_operator_message'
                    AND (status IN ('pending', 'sending', 'failed', 'outcome_unknown') OR (
                        status = 'abandoned' AND kind = 'reopen_request' AND EXISTS (
                            SELECT 1 FROM conversation_messages AS held
                            WHERE held.prerequisite_action_id = operator_actions.id AND held.processing_state = 'held'
                        )
                    ))
                """, SqliteDatabase.timestamp(now), request.channel(), request.chatId());
        var heldRequestIds = new ArrayList<String>();
        try (var query = prepare("""
                SELECT id FROM support_requests AS previous WHERE channel = ? AND external_conversation_id = ?
                    AND status = 'closed' AND EXISTS (
                        SELECT 1 FROM conversation_messages AS held
                        WHERE held.request_id = previous.id AND held.processing_state = 'held'
                    )
                ORDER BY previous.rowid
                """, request.channel(), request.chatId()); var rows = query.executeQuery()) {
            while (rows.next()) {
                heldRequestIds.add(rows.getString("id"));
            }
        }
        for (var previousId : heldRequestIds) {
            SqliteStartupRecovery.releaseHeldReplies(connection, previousId, now);
        }
    }

    private Optional<Request> bindOperatorEvent(String eventId, String topicId, String messageId, Instant receivedAt)
            throws SQLException {
        var bound = findRequest("""
                SELECT request.* FROM operator_event_bindings AS binding
                JOIN support_requests AS request ON request.id = binding.request_id
                WHERE binding.source = ? AND binding.external_event_id = ?
                """, OPERATOR_SOURCE, eventId);
        if (bound.isPresent()) {
            return bound;
        }
        var request = findRequestForOperatorEvent(topicId, receivedAt, messageId);
        if (request.isPresent()) {
            execute("""
                    INSERT INTO operator_event_bindings (source, external_event_id, request_id) VALUES (?, ?, ?)
                    """, OPERATOR_SOURCE, eventId, request.get().id());
        }
        return request;
    }

    private boolean isCurrent(Request request) throws SQLException {
        return findRequest("""
                SELECT * FROM support_requests AS candidate
                WHERE candidate.id = ? AND candidate.id = (
                    SELECT latest.id FROM support_requests AS latest WHERE latest.channel = candidate.channel
                        AND latest.external_conversation_id = candidate.external_conversation_id
                    ORDER BY latest.created_at DESC, latest.rowid DESC LIMIT 1
                ) AND NOT EXISTS (
                    SELECT 1 FROM support_requests AS active WHERE active.channel = candidate.channel
                        AND active.external_conversation_id = candidate.external_conversation_id
                        AND active.id != candidate.id AND active.status = 'active'
                )
                """, request.id()).isPresent();
    }

    private void applyTransition(String requestId, String topicId, TopicTransition transition, Instant now)
            throws SQLException {
        if (transition == TopicTransition.REOPEN) {
            if (!SqliteStartupRecovery.reactivateRequest(connection, requestId, topicId)) {
                throw new SQLException("Operator action could not reopen the expected request generation");
            }
            SqliteStartupRecovery.releaseHeldReplies(connection, requestId, now);
            return;
        }
        if (execute("""
                UPDATE support_requests SET status = 'closed', closed_at = COALESCE(closed_at, ?)
                WHERE id = ? AND operator_topic_id = ?
                """, SqliteDatabase.timestamp(now), requestId, topicId) != 1) {
            throw new SQLException("Operator action could not close the expected request generation");
        }
    }

    private boolean hasTopicOpening(Request request, ClientText text) throws SQLException {
        var action = topicOpening(request, text);
        try (var query = prepare("""
                SELECT 1 FROM operator_actions AS action
                JOIN support_requests AS request ON request.id = action.request_id
                WHERE action.id = ? AND action.request_id = ? AND action.kind = 'open_request'
                    AND action.client_message_id = ? AND action.operator_topic_id = ?
                    AND action.status NOT IN ('abandoned', 'superseded') AND request.web_owned_at IS NULL
                """, action.id(), action.requestId(), action.clientMessageId(), action.topicId());
                var rows = query.executeQuery()) {
            return rows.next();
        }
    }

    private void prepareOperatorAction(OperatorAction action, String timestamp) throws SQLException {
        execute("""
                INSERT INTO operator_actions (id, request_id, kind, client_message_id, operator_topic_id, sequence,
                                              initial, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                ON CONFLICT (id) DO NOTHING
                """, action.id(), action.requestId(), action.kind(), action.clientMessageId(), action.topicId(),
                action.sequence(), action.initial() ? 1 : 0, timestamp);
    }

    private Optional<Request> findRequestForOperatorEvent(String topicId, Instant receivedAt, String messageId)
            throws SQLException {
        var second = receivedAt.truncatedTo(ChronoUnit.SECONDS);
        var eligible = new ArrayList<TopicGeneration>();
        try (var query = prepare("""
                SELECT request.*, (
                    SELECT MIN(CAST(action.external_result_id AS INTEGER)) FROM operator_actions AS action
                    WHERE action.request_id = request.id AND action.operator_topic_id = ?
                        AND action.kind = 'relay_message' AND action.initial = 1
                        AND action.external_result_id != '' AND action.external_result_id NOT GLOB '*[^0-9]*'
                ) AS first_operator_message_id
                FROM support_requests AS request
                WHERE request.operator_topic_id = ? AND request.created_at < ?
                ORDER BY request.created_at DESC, request.rowid DESC
                """, topicId, topicId, SqliteDatabase.timestamp(second.plusSeconds(1)));
                var rows = query.executeQuery()) {
            while (rows.next()) {
                var firstMessageId = rows.getLong("first_operator_message_id");
                var start = rows.wasNull() ? null : Long.valueOf(firstMessageId);
                eligible.add(new TopicGeneration(request(rows), Instant.parse(rows.getString("created_at")), start));
            }
        }
        if (eligible.size() == 1) {
            return Optional.of(eligible.getFirst().request());
        }
        var messageNumber = Long.parseLong(messageId);
        for (int index = 0; index < eligible.size(); index++) {
            var generation = eligible.get(index);
            var start = generation.firstMessageId();
            if (start != null && start > messageNumber) {
                continue;
            }
            if (start == null && index + 1 < eligible.size()
                    && generation.createdAt().truncatedTo(ChronoUnit.SECONDS).equals(second)) {
                return Optional.empty();
            }
            return Optional.of(generation.request());
        }
        return Optional.empty();
    }

    private boolean isFirstClientMessage(String requestId, String messageId) throws SQLException {
        try (var query = prepare("""
                SELECT external_message_id FROM conversation_messages
                WHERE request_id = ? AND direction = 'client_to_operator' ORDER BY rowid LIMIT 1
                """, requestId); var rows = query.executeQuery()) {
            return rows.next() && messageId.equals(rows.getString("external_message_id"));
        }
    }

    private boolean hasHandled(String source, String eventId) throws SQLException {
        try (var query = prepare("""
                SELECT 1 FROM processed_events WHERE source = ? AND external_event_id = ? AND status = 'completed'
                """, source, eventId); var rows = query.executeQuery()) {
            return rows.next();
        }
    }

    private void markHandled(String source, String eventId, Instant now) throws SQLException {
        var timestamp = SqliteDatabase.timestamp(now);
        execute("""
                INSERT INTO processed_events (source, external_event_id, claimed_at, status, completed_at)
                VALUES (?, ?, ?, 'completed', ?) ON CONFLICT (source, external_event_id) DO NOTHING
                """, source, eventId, timestamp, timestamp);
    }

    private void recordMessage(String requestId, String direction, String messageId, String sender,
            String text, Instant receivedAt) throws SQLException {
        execute("""
                INSERT INTO conversation_messages
                    (id, request_id, direction, external_message_id, sender_name, text, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (request_id, direction, external_message_id) DO NOTHING
                """, UUID.randomUUID().toString(), requestId, direction, messageId, sender, text,
                SqliteDatabase.timestamp(receivedAt));
    }

    private void usage(String id, String type, Request request, Instant now) throws SQLException {
        execute("""
                INSERT INTO usage_events (id, event_type, channel, request_id, occurred_at) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (id) DO NOTHING
                """, id, type, request.channel(), request.id(), SqliteDatabase.timestamp(now));
    }

    private Optional<Request> findRequest(String sql, Object... args) throws SQLException {
        try (var query = prepare(sql, args); var rows = query.executeQuery()) {
            return rows.next() ? Optional.of(request(rows)) : Optional.empty();
        }
    }

    private static Request request(ResultSet rows) throws SQLException {
        return new Request(rows.getString("id"), rows.getString("channel"),
                rows.getString("external_conversation_id"), rows.getString("operator_topic_id"), rows.getString("status"));
    }

    private int execute(String sql, Object... args) throws SQLException {
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
        } catch (SQLException | RuntimeException failure) {
            try {
                statement.close();
            } catch (SQLException closeFailure) {
                failure.addSuppressed(closeFailure);
            }
            throw failure;
        }
    }
}
