package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.inboxpoint.handoff.ClientMessages;
import com.inboxpoint.handoff.OperatorHandoff;
import com.inboxpoint.persistence.SqliteTextHandoff;
import com.inboxpoint.persistence.SqliteTextHandoff.ClientHistory;
import com.inboxpoint.persistence.SqliteTextHandoff.ClientText;
import com.inboxpoint.persistence.SqliteTextHandoff.NativeOperatorText;
import com.inboxpoint.persistence.SqliteTextHandoff.OperatorAction;
import com.inboxpoint.persistence.SqliteTextHandoff.Request;
import com.inboxpoint.persistence.SqliteTextHandoff.TopicTransition;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class TelegramTextHandoff implements AutoCloseable, OperatorHandoff {
    private static final String SOURCE = "telegram:get-updates";
    private static final long MAX_SAFE_INTEGER = (1L << 53) - 1;
    private static final int TELEGRAM_TEXT_LIMIT = 4096;
    private static final List<String> UNSUPPORTED_CONTENT = List.of(
            "animation", "audio", "contact", "dice", "document", "paid_media", "photo",
            "poll", "sticker", "story", "venue", "video", "video_note", "voice");
    private static final JsonMapper JSON = JsonMapper.shared();

    private final SqliteTextHandoff store;
    private final TelegramBotApi api;
    private final TelegramClientMenu clientMenu;
    private final long operatorChatId;
    private final Clock clock;

    static TelegramTextHandoff open(Path database, TelegramBotApi api, long operatorChatId, Clock clock)
            throws SQLException {
        return new TelegramTextHandoff(database, SqliteTextHandoff.open(database, clock.instant()), api,
                operatorChatId, clock);
    }

    static TelegramTextHandoff openVerified(Path database, TelegramBotApi api, long operatorChatId, Clock clock)
            throws SQLException, IOException, InterruptedException {
        var store = SqliteTextHandoff.open(database, clock.instant());
        try {
            return connect(database, store, api, operatorChatId, clock);
        } catch (SQLException | IOException | InterruptedException | RuntimeException failure) {
            try {
                store.close();
            } catch (SQLException closeFailure) {
                failure.addSuppressed(closeFailure);
            }
            throw failure;
        }
    }

    public static TelegramTextHandoff connect(Path database, SqliteTextHandoff store, TelegramHttpTransport transport, URI origin,
            String token, long operatorChatId, Duration timeout, Clock clock)
            throws SQLException, IOException, InterruptedException {
        return connect(database, store, new TelegramBotApi(transport, origin, token, timeout), operatorChatId, clock);
    }

    public static String verifyIdentity(TelegramHttpTransport transport, URI origin, String token, long operatorChatId,
            Duration timeout) throws IOException, InterruptedException {
        return verifyIdentity(new TelegramBotApi(transport, origin, token, timeout), operatorChatId);
    }

    public record OperatorChat(long id, boolean isForum, String title, String type) { }

    public static List<OperatorChat> discoverChats(TelegramHttpTransport transport, URI origin, String token,
            Duration timeout) throws IOException, InterruptedException {
        return new TelegramBotApi(transport, origin, token, timeout).discoverChats();
    }

    private static String verifyIdentity(TelegramBotApi api, long operatorChatId) throws IOException, InterruptedException {
        return api.verifySetup(operatorChatId) + ":" + operatorChatId;
    }

    private static TelegramTextHandoff connect(Path database, SqliteTextHandoff store, TelegramBotApi api,
            long operatorChatId, Clock clock) throws SQLException, IOException, InterruptedException {
        var identity = verifyIdentity(api, operatorChatId);
        return switch (store.claimChannelIdentity("telegram", identity)) {
            case ACCEPTED -> new TelegramTextHandoff(database, store, api, operatorChatId, clock);
            case CONFLICT -> throw new IOException("Telegram connection identity conflicts with the existing history");
            case LEGACY_UNBOUND -> throw new IOException("Telegram history requires confirmation of the existing identity");
        };
    }

    private TelegramTextHandoff(Path database, SqliteTextHandoff store, TelegramBotApi api,
            long operatorChatId, Clock clock) {
        this.store = store;
        this.api = api;
        this.clientMenu = new TelegramClientMenu(database, store, api);
        this.operatorChatId = operatorChatId;
        this.clock = clock;
    }

    void poll(int timeoutSeconds) throws SQLException, IOException, InterruptedException {
        poll(store, timeoutSeconds);
    }

    public boolean poll(SqliteTextHandoff inbox, int timeoutSeconds) throws SQLException, IOException, InterruptedException {
        if (inbox.pendingUpdate(SOURCE).isPresent()) {
            return false;
        }
        var offset = readOffset(inbox);
        var updates = api.getUpdates(offset, timeoutSeconds);
        if (updates.isEmpty()) {
            return true;
        }
        var batch = new ArrayList<SqliteTextHandoff.IncomingUpdate>(updates.size());
        long nextOffset = offset == null ? 0 : offset;
        for (var update : updates) {
            var updateId = update.path("update_id").longValue();
            nextOffset = Math.max(nextOffset, updateId + 1);
            batch.add(new SqliteTextHandoff.IncomingUpdate(Long.toString(updateId), update.toString()));
        }
        inbox.saveUpdates(SOURCE, batch, Long.toString(nextOffset), clock.instant());
        return true;
    }

    public boolean processNext() throws SQLException, InterruptedException {
        var next = store.pendingUpdate(SOURCE);
        if (next.isEmpty()) {
            return false;
        }
        var event = next.get();
        if (event.retryAt() != null && event.retryAt().isAfter(clock.instant())) {
            return false;
        }
        try {
            route(event.id(), parseUpdate(event.payload()));
            store.completeUpdate(SOURCE, event.id());
        } catch (UnhandledUpdate failure) {
            store.failUpdate(SOURCE, event.id(), failure.getMessage(), clock.instant(), 1);
        } catch (TelegramBotApi.RequestFailed failure) {
            store.failUpdate(SOURCE, event.id(), failure.getMessage(), clock.instant().plusSeconds(1),
                    failure.outcomeUnknown() ? 1 : 3);
        }
        return true;
    }

    public void sendPending() throws SQLException, InterruptedException {
        if (clientMenu.deliveryPaused()) {
            notifyEnrollmentConfirmations();
            return;
        }
        for (var delivery : store.pendingTelegramDeliveries(clock.instant())) {
            if (clientMenu.deliveryPaused()) {
                break;
            }
            long chatId;
            try {
                chatId = Long.parseLong(delivery.conversationId());
                if (chatId <= 0 || chatId > MAX_SAFE_INTEGER) {
                    throw new NumberFormatException();
                }
            } catch (NumberFormatException failure) {
                if (store.claimDelivery(delivery.id(), clock.instant())) {
                    store.failDelivery(delivery.id(), "Invalid stored Telegram destination", false, clock.instant());
                }
                continue;
            }
            var markup = clientMenu.mainMarkup(chatId, clock.instant());
            if (!store.claimDelivery(delivery.id(), clock.instant())) {
                continue;
            }
            long externalId;
            try {
                externalId = api.sendMessage(chatId, null, delivery.text(), markup);
            } catch (TelegramBotApi.RequestFailed failure) {
                store.failDelivery(delivery.id(), failure.getMessage(), failure.outcomeUnknown(), clock.instant());
                continue;
            }
            store.completeDelivery(delivery.id(), Long.toString(externalId), clock.instant());
        }
        notifyEnrollmentConfirmations();
    }

    private void notifyEnrollmentConfirmations() throws SQLException, InterruptedException {
        for (var notification : store.enrollmentNotifications(clock.instant())) {
            try {
                api.editMessageReplyMarkup(operatorChatId, parseTopic(notification.operatorMessageId()),
                        TelegramClientMenu.enrollmentMarkup(notification.enrollmentId(), true));
                store.finishEnrollmentNotification(notification.enrollmentId(), true, clock.instant());
            } catch (TelegramBotApi.RequestFailed | UnhandledUpdate failure) {
                store.finishEnrollmentNotification(notification.enrollmentId(), false, clock.instant());
            }
        }
    }

    public boolean retryHeldOperatorReply(String actionId) throws SQLException, InterruptedException {
        var action = store.findRetryableHeldReopen(actionId);
        if (action.isEmpty()) {
            return false;
        }
        try {
            applyTelegramTopicAction(action.get(), TopicTransition.REOPEN);
        } catch (TelegramBotApi.RequestFailed failure) {
            // The attempted retry records a new failure or an uncertain outcome.
        } catch (UnhandledUpdate failure) {
            return false;
        }
        return true;
    }

    public void notifyFailedDeliveries() throws SQLException, InterruptedException {
        for (var delivery : store.deliveryNotifications(clock.instant())) {
            var channel = "telegram".equals(delivery.channel()) ? "Telegram" : "VK";
            var reference = delivery.messageId() == null ? "" : "\nСообщение администратора: " + delivery.messageId();
            var text = delivery.uncertain()
                    ? "⚠️ Не удалось подтвердить доставку ответа.\n\nКанал: " + channel + reference
                        + "\n\nПроверьте, получил ли клиент ответ, и укажите результат в разделе «Мониторинг»."
                    : "⚠️ Ответ не доставлен.\n\nКанал: " + channel + reference
                        + "\n\nОткройте раздел «Мониторинг» в Inbox Point, чтобы повторить отправку.";
            try {
                api.sendMessage(operatorChatId, parseTopic(delivery.topicId()), text);
                store.finishDeliveryNotification(delivery.id(), true, clock.instant());
            } catch (TelegramBotApi.RequestFailed | UnhandledUpdate failure) {
                store.finishDeliveryNotification(delivery.id(), false, clock.instant());
            }
        }
    }

    public void recoverWebRequests() throws SQLException, InterruptedException {
        for (var request : store.recoverableWebRequests()) {
            try {
                recoverWebRequest(store.prepareWebRecovery(request));
            } catch (TelegramBotApi.RequestFailed | UnhandledUpdate failure) {
                // The attempted transfer records the outcome independently for each request.
            }
        }
    }

    private void recoverWebRequest(SqliteTextHandoff.WebRecovery recovery)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed, UnhandledUpdate {
        var request = recovery.request();
        var first = recovery.messages().getFirst();
        var opening = recovery.opening();
        long topic = sendAction(opening, () -> opening.id().equals(SqliteTextHandoff.recoveryOpening(request, first.messageId(), null).id())
                ? openTopic(recovery.reusableTopic(), request.channel(), first.sender())
                : api.createForumTopic(operatorChatId, topicTitle(request.channel(), first.sender())));
        try {
            relayRecoveryHistory(recovery, topic);
        } catch (TelegramBotApi.RequestFailed failure) {
            if (failure.outcomeUnknown() || (failure.topicProblem() != TelegramBotApi.TopicProblem.MISSING
                    && failure.topicProblem() != TelegramBotApi.TopicProblem.CLOSED)) {
                throw failure;
            }
            var replacement = SqliteTextHandoff.recoveryOpening(request, first.messageId(), Long.toString(topic));
            topic = sendAction(replacement, () -> api.createForumTopic(operatorChatId, topicTitle(request.channel(), first.sender())));
            relayRecoveryHistory(recovery, topic);
        }
        if (!store.finishWebRecovery(recovery, Long.toString(topic), clock.instant())) {
            var abandoned = topic;
            var close = new OperatorAction("operator-close-recovery:" + request.id() + ":" + abandoned, request.id(),
                    "close_request", first.messageId(), Long.toString(abandoned), 0, false);
            sendAction(close, () -> {
                api.closeTopic(operatorChatId, abandoned);
                return abandoned;
            });
        }
    }

    private void relayRecoveryHistory(SqliteTextHandoff.WebRecovery recovery, long topic)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed, UnhandledUpdate {
        var web = recovery.request();
        var request = new Request(web.id(), web.channel(), web.chatId(), Long.toString(topic), web.status());
        var initial = true;
        for (var message : recovery.messages()) {
            sendClientHistory(request, message, initial, "recovery:" + topic);
            initial = false;
        }
    }

    @Override
    public void close() throws SQLException {
        store.close();
    }

    private Long readOffset(SqliteTextHandoff inbox) throws SQLException {
        var stored = inbox.cursor(SOURCE);
        if (stored.isEmpty()) {
            return null;
        }
        try {
            var offset = Long.parseLong(stored.get());
            if (offset >= 0 && offset <= MAX_SAFE_INTEGER && Long.toString(offset).equals(stored.get())) {
                return offset;
            }
        } catch (NumberFormatException ignored) {
            // A corrupt offset must not acknowledge later updates.
        }
        throw new SQLException("Stored Telegram update offset is invalid");
    }

    private void route(String eventId, JsonNode update)
            throws UnhandledUpdate, SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        if (!Long.toString(integer(update.path("update_id"))).equals(eventId)) {
            throw new UnhandledUpdate("Stored Telegram update ID does not match the event");
        }
        if (update.has("edited_message")) {
            return;
        }
        if (update.has("callback_query")) {
            handleCallback(eventId, update.path("callback_query"));
            return;
        }
        var message = update.path("message");
        if (message.isMissingNode()) {
            return;
        }
        if (!message.isObject()) {
            throw new UnhandledUpdate("Telegram update requires the full router");
        }
        var chat = message.path("chat");
        var chatType = chat.path("type").asString("");
        var chatId = integer(chat.path("id"));
        var customer = "private".equals(chatType) && chatId > 0;
        var operator = "supergroup".equals(chatType) && chatId == operatorChatId
                && message.has("message_thread_id");
        if (!customer && !operator) {
            return;
        }
        var from = message.path("from");
        var isBot = from.path("is_bot");
        if (isBot.isBoolean() && isBot.booleanValue()) {
            return;
        }
        var rawMessageId = integer(message.path("message_id"));
        var rawDate = integer(message.path("date"));
        if (rawMessageId <= 0 || rawDate < 0 || rawDate > 253_402_300_799L) {
            throw new UnhandledUpdate("Telegram update contains an invalid message ID or date");
        }
        var messageId = Long.toString(rawMessageId);
        var receivedAt = Instant.ofEpochSecond(rawDate);
        if (operator && (message.has("forum_topic_closed") || message.has("forum_topic_reopened"))) {
            var topicId = positiveTopic(message);
            var transition = message.path("forum_topic_closed").isObject() ? TopicTransition.CLOSE
                    : message.path("forum_topic_reopened").isObject() ? TopicTransition.REOPEN : null;
            if (transition == null) {
                throw new UnhandledUpdate("Telegram topic state update is invalid");
            }
            store.observeTopicTransition(eventId, topicId, messageId, receivedAt, transition);
            return;
        }
        if (!isBot.isBoolean() || UNSUPPORTED_CONTENT.stream().anyMatch(message::has)
                || !message.path("text").isString()) {
            if (customer && isBot.isBoolean() && !isBot.booleanValue()) {
                clientMenu.unsupported(chatId, eventId, clock.instant());
                return;
            }
            throw new UnhandledUpdate("Telegram update requires the full text and content router");
        }
        var text = message.path("text").asString();
        if (text.isBlank()) {
            return;
        }
        if (operator) {
            dispatchOperatorText(eventId, positiveTopic(message), messageId, receivedAt, text);
            return;
        }
        if (store.hasHandledClientText(eventId) || clientMenu.handle(chatId, eventId, text, null, clock.instant())) {
            return;
        }
        relayClientText(new ClientText(eventId, Long.toString(chatId), messageId, displayName(from), text, receivedAt));
    }

    private void handleCallback(String eventId, JsonNode callback)
            throws SQLException, TelegramBotApi.RequestFailed, InterruptedException, UnhandledUpdate {
        var action = callback.path("data").asString("");
        var callbackId = callback.path("id").asString("");
        var message = callback.path("message");
        var chat = message.path("chat");
        var from = callback.path("from");
        var bot = from.path("is_bot");
        if (callbackId.isBlank() || action.isBlank() || !bot.isBoolean()) {
            return;
        }
        if (action.startsWith("enroll:")) {
            var enrollment = action.substring(7);
            var status = "unavailable";
            if (!bot.booleanValue() && "supergroup".equals(chat.path("type").asString(""))
                    && integer(chat.path("id")) == operatorChatId && message.has("message_thread_id")
                    && enrollment.matches("[A-Za-z0-9_-]{1,36}")) {
                status = store.confirmEnrollment(enrollment, positiveTopic(message),
                        Long.toString(integer(message.path("message_id"))), clock.instant());
            }
            var notice = switch (status) {
                case "pending" -> "Подтверждение отправляется клиенту.";
                case "sent" -> "Подтверждение уже отправлено.";
                case "failed" -> "Не удалось отправить подтверждение. Проверьте ошибку доставки.";
                default -> "Эта запись больше недоступна для подтверждения.";
            };
            api.answerCallback(callbackId, notice);
            return;
        }
        if (!bot.booleanValue() && "private".equals(chat.path("type").asString(""))) {
            var chatId = integer(chat.path("id"));
            if (chatId > 0 && chatId == integer(from.path("id"))) {
                clientMenu.handle(chatId, eventId, "", action, clock.instant());
                api.answerCallback(callbackId, null);
            }
        }
    }

    private void dispatchOperatorText(String eventId, String topicId, String messageId, Instant receivedAt, String text)
            throws SQLException, TelegramBotApi.RequestFailed, InterruptedException, UnhandledUpdate {
        var transition = operatorLifecycleCommand(text);
        if (transition == null) {
            if (!store.queueOperatorReply(eventId, topicId, messageId, text, receivedAt, clock.instant())) {
                var held = store.holdOperatorReply(eventId, topicId, messageId, text, receivedAt, clock.instant())
                        .orElseThrow(() -> new UnhandledUpdate("Telegram reply requires a matching request generation"));
                if (held.startReopen()) {
                    try {
                        applyTelegramTopicAction(held.prerequisite(), TopicTransition.REOPEN);
                    } catch (TelegramBotApi.RequestFailed failure) {
                        // The action records the incident and the reply remains held for confirmation or resolution.
                    }
                }
                store.finishTopicCommand(eventId, clock.instant());
            }
            return;
        }
        var action = store.prepareTopicCommand(eventId, topicId, messageId, receivedAt, transition, clock.instant());
        if (action.isPresent()) {
            applyTelegramTopicAction(action.get(), transition);
            store.finishTopicCommand(eventId, clock.instant());
        }
    }

    private void applyTelegramTopicAction(OperatorAction action, TopicTransition transition)
            throws SQLException, TelegramBotApi.RequestFailed, InterruptedException, UnhandledUpdate {
        var topic = parseTopic(action.topicId());
        sendAction(action, () -> {
            if (transition == TopicTransition.CLOSE) {
                api.closeTopic(operatorChatId, topic);
            } else {
                api.reopenTopic(operatorChatId, topic);
            }
            return topic;
        });
    }

    @Override
    public void relayClientText(ClientText text)
            throws UnhandledUpdate, SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        if (store.hasHandledClientText(text.channel(), text.eventId())) {
            return;
        }
        var relay = store.stageClientText(text, clock.instant())
                .orElseThrow(() -> new UnhandledUpdate("New request requires explicit intake"));
        var request = relay.request();
        long topic;
        if (request.topicId().startsWith("web:")) {
            if (!relay.openingTopic()) {
                store.finishClientTextInWeb(request, text, relay.application(), true, clock.instant());
                return;
            }
            var action = SqliteTextHandoff.topicOpening(request, text);
            try {
                topic = sendAction(action, () -> openTopic(relay.reusableTopicId(), text.channel(), text.sender()));
            } catch (TelegramBotApi.RequestFailed failure) {
                store.finishClientTextInWeb(request, text, relay.application(), !failure.outcomeUnknown(),
                        clock.instant());
                return;
            }
        } else {
            topic = parseTopic(request.topicId());
        }
        var target = new Request(request.id(), request.channel(), request.chatId(), Long.toString(topic), request.status());
        try {
            sendClientHistory(target, new ClientHistory(text.messageId(), text.sender(), relay.text(), relay.enrollmentId()),
                    relay.initial(), null);
        } catch (TelegramBotApi.RequestFailed failure) {
            if (failure.outcomeUnknown()) {
                throw failure;
            }
            store.finishClientTextInWeb(target, text, relay.application(), true, clock.instant());
            return;
        }
        store.finishClientText(target, text, relay.application(), clock.instant());
    }

    private void sendClientHistory(Request request, ClientHistory message, boolean initial, String scope)
            throws UnhandledUpdate, SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        var topic = parseTopic(request.topicId());
        var messages = formattedMessages(request.channel(), message.sender(), message.text(), initial);
        var actions = new ArrayList<OperatorAction>(messages.size());
        for (int sequence = 0; sequence < messages.size(); sequence++) {
            var id = "operator-relay:" + request.id() + ":" + message.messageId() + ":" + sequence
                    + (scope == null ? "" : ":" + scope);
            actions.add(new OperatorAction(id, request.id(), "relay_message", message.messageId(),
                    request.topicId(), sequence, initial));
        }
        store.prepareRelayActions(actions, clock.instant());
        TelegramBotApi.RequestFailed uncertain = null;
        for (var action : actions) {
            var body = messages.get(action.sequence());
            var replyMarkup = action.sequence() == 0 && message.enrollmentId() != null
                    ? TelegramClientMenu.enrollmentMarkup(message.enrollmentId(), false) : null;
            try {
                sendAction(action, () -> api.sendMessage(operatorChatId, topic, body, replyMarkup));
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.outcomeUnknown()) {
                    uncertain = failure;
                    continue;
                }
                throw uncertain == null ? failure : uncertain;
            }
        }
        if (uncertain != null) {
            throw uncertain;
        }
    }

    @Override
    public void mirrorNativeReply(Request request, NativeOperatorText text)
            throws UnhandledUpdate, SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        if (request.topicId().startsWith("web:") || !store.canMirrorNativeReply(request)) {
            return;
        }
        try {
            mirrorWithHistory(request, text);
        } catch (TelegramBotApi.RequestFailed failure) {
            var problem = failure.topicProblem();
            if (failure.outcomeUnknown() || (problem != TelegramBotApi.TopicProblem.MISSING
                    && problem != TelegramBotApi.TopicProblem.CLOSED)) {
                throw failure;
            }
            if (!store.canMirrorNativeReply(request)) {
                return;
            }
            var first = store.firstClientMessage(request).orElseThrow(() -> failure);
            var action = new OperatorAction("operator-open-replacement:" + request.id() + ":" + request.topicId(),
                    request.id(), "open_request", first.messageId(), request.topicId(), 0, true);
            var topic = sendAction(action,
                    () -> api.createForumTopic(operatorChatId, topicTitle(request.channel(), first.sender())));
            mirrorWithHistory(new Request(request.id(), request.channel(), request.chatId(), Long.toString(topic),
                    request.status()), text);
        }
    }

    private void mirrorWithHistory(Request request, NativeOperatorText text)
            throws UnhandledUpdate, SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        var history = store.replacementHistory(request);
        var scope = history.isPresent() ? "replacement:" + request.topicId() : null;
        if (history.isPresent()) {
            var initial = true;
            for (var clientMessage : history.get()) {
                sendClientHistory(request, clientMessage, initial, scope);
                initial = false;
            }
        }
        sendNativeMirror(request, text, scope);
    }

    private void sendNativeMirror(Request request, NativeOperatorText text, String scope)
            throws UnhandledUpdate, SQLException, TelegramBotApi.RequestFailed, InterruptedException {
        var topic = parseTopic(request.topicId());
        var messages = splitText(text.text(), "Ответ администратора из VK:\n\n",
                "Продолжение ответа администратора из VK:\n\n");
        var actions = new ArrayList<OperatorAction>(messages.size());
        for (int sequence = 0; sequence < messages.size(); sequence++) {
            var id = "operator-mirror:" + request.id() + (scope == null ? "" : ":" + scope) + ":vk:"
                    + text.messageId() + ":" + sequence;
            actions.add(new OperatorAction(id, request.id(), "mirror_operator_message", text.messageId(),
                    request.topicId(), sequence, false));
        }
        store.prepareRelayActions(actions, clock.instant());
        var uncertain = false;
        for (var action : actions) {
            var body = messages.get(action.sequence());
            try {
                sendAction(action, () -> api.sendMessage(operatorChatId, topic, body));
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.outcomeUnknown()) {
                    uncertain = true;
                } else if (!uncertain) {
                    throw failure;
                } else {
                    // Leave the original uncertain action for operator resolution.
                    return;
                }
            }
        }
    }

    private long openTopic(String reusableTopicId, String channel, String sender)
            throws TelegramBotApi.RequestFailed, InterruptedException, UnhandledUpdate {
        if (reusableTopicId != null) {
            var topic = parseTopic(reusableTopicId);
            try {
                api.reopenTopic(operatorChatId, topic);
                return topic;
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.topicProblem() != TelegramBotApi.TopicProblem.MISSING) {
                    throw failure;
                }
            }
        }
        return api.createForumTopic(operatorChatId, topicTitle(channel, sender));
    }

    private long sendAction(OperatorAction action, TelegramAction effect)
            throws SQLException, TelegramBotApi.RequestFailed, InterruptedException, UnhandledUpdate {
        var claimed = store.claimOperatorAction(action, clock.instant());
        if ("sent".equals(claimed.status())) {
            if (("relay_message".equals(action.kind()) || "mirror_operator_message".equals(action.kind()))
                    && claimed.externalResultId() == null) {
                // An operator confirmed receipt without a Telegram message ID.
                return 0;
            }
            return parseTopic(claimed.externalResultId());
        }
        if (!"claimed".equals(claimed.status())) {
            throw new TelegramBotApi.RequestFailed("Previous Telegram operator action requires resolution", true);
        }
        long result;
        try {
            result = effect.send();
        } catch (TelegramBotApi.RequestFailed failure) {
            store.failOperatorAction(action.id(), failure.getMessage(), failure.outcomeUnknown());
            throw failure;
        }
        store.completeOperatorAction(action, Long.toString(result), clock.instant());
        return result;
    }

    private static JsonNode parseUpdate(String payload) throws UnhandledUpdate {
        try {
            return JSON.readTree(payload);
        } catch (JacksonException failure) {
            throw new UnhandledUpdate("Stored Telegram update is invalid");
        }
    }

    private static long parseTopic(String value) throws UnhandledUpdate {
        if (value != null) {
            try {
                var id = Long.parseLong(value);
                if (id > 0 && id <= MAX_SAFE_INTEGER) {
                    return id;
                }
            } catch (NumberFormatException ignored) {
                // A stored topic or external result ID is used only if it is valid.
            }
        }
        throw new UnhandledUpdate("Stored Telegram external identifier is invalid");
    }

    private static long integer(JsonNode value) throws UnhandledUpdate {
        if (value.isIntegralNumber() && value.canConvertToLong()) {
            var number = value.longValue();
            if (number >= -MAX_SAFE_INTEGER && number <= MAX_SAFE_INTEGER) {
                return number;
            }
        }
        throw new UnhandledUpdate("Telegram update contains an invalid number");
    }

    private static TopicTransition operatorLifecycleCommand(String text) {
        var command = text.strip().split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        return switch (command) {
            case "/close" -> TopicTransition.CLOSE;
            case "/reopen" -> TopicTransition.REOPEN;
            default -> null;
        };
    }

    private static String positiveTopic(JsonNode message) throws UnhandledUpdate {
        var topic = integer(message.path("message_thread_id"));
        if (topic <= 0) {
            throw new UnhandledUpdate("Telegram operator topic ID is invalid");
        }
        return Long.toString(topic);
    }

    private static String displayName(JsonNode user) {
        var name = (user.path("first_name").asString("") + " " + user.path("last_name").asString("")).strip();
        if (!name.isEmpty()) {
            return truncate(name, 256);
        }
        var username = user.path("username").asString("").strip();
        return username.isEmpty() ? "Пользователь Telegram" : truncate("@" + username, 256);
    }

    private static String topicTitle(String channel, String displayName) {
        var title = ("vk".equals(channel) ? "VK - " : "TG - ") + displayName.replaceAll("(?U)\\s+", " ").strip();
        return truncate(title, 128);
    }

    private static String truncate(String text, int maxCodePoints) {
        return text.substring(0, text.offsetByCodePoints(0, Math.min(maxCodePoints, text.codePointCount(0, text.length()))));
    }

    private static List<String> formattedMessages(String channel, String sender, String body, boolean initial) {
        var name = "vk".equals(channel) ? "VK" : "Telegram";
        var prefix = initial
                ? String.join("\n", "Новое обращение из " + name, "Отправитель: " + sender, "",
                        "Ответьте сообщением в этой теме.", "Чтобы закрыть обращение, отправьте /close.", "",
                        "Первое сообщение:", "")
                : "Сообщение:\n\n";
        return splitText(body, prefix, "Продолжение сообщения:\n\n");
    }

    private static List<String> splitText(String body, String prefix, String continuation) {
        var characters = body.codePoints().toArray();
        var messages = new ArrayList<String>();
        for (int offset = 0; offset < characters.length;) {
            var available = TELEGRAM_TEXT_LIMIT - prefix.codePointCount(0, prefix.length());
            var length = Math.min(available, characters.length - offset);
            messages.add(prefix + new String(characters, offset, length));
            offset += length;
            prefix = continuation;
        }
        return messages;
    }

    @FunctionalInterface
    private interface TelegramAction {
        long send() throws TelegramBotApi.RequestFailed, InterruptedException, UnhandledUpdate;
    }

    private static final class UnhandledUpdate extends IOException {
        UnhandledUpdate(String reason) {
            super(reason);
        }
    }
}
