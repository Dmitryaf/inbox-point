package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

final class HandoffService {
    static final String ACKNOWLEDGEMENT = "Вопрос отправлен.";
    static final String DELAYED = "Вопрос сохранён. Доставка оператору задерживается.";
    static final String RECOVERED = "Вопрос доставлен оператору.";
    private static final int MESSAGE_LIMIT = 4096;
    private final TelegramStore store;
    private final OperatorInbox inbox;
    private final Clock clock;
    private final ClientMessageQueue queue;

    HandoffService(TelegramStore store, OperatorInbox inbox, Clock clock, ClientMessageQueue queue) {
        this.store = store;
        this.inbox = inbox;
        this.clock = clock;
        this.queue = queue;
    }

    void processVk(String event, long peer, long message, String name, String text)
            throws SQLException, InterruptedException, IOException {
        queue.run("vk", peer, () -> processVkSerially(event, peer, message, name, text));
    }

    private void processVkSerially(String event, long peer, long message, String name, String text)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (!store.claim("client:vk", event, clock.instant())) {
            return;
        }
        try {
            relayQuestion("vk", peer, peer + ":" + message, text, name);
            store.completeEvent("client:vk", event, clock.instant());
        } catch (TelegramBotApi.RequestFailed failure) {
            if (!failure.outcomeUnknown()) {
                store.release("client:vk", event);
            } else {
                store.completeEvent("client:vk", event, clock.instant());
            }
            throw failure;
        }
    }

    void relayQuestion(String channel, long chat, String message, String text, String name)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.activeRequest(channel, chat);
        if (request != null) {
            try {
                relayChunks(request, message, name, text, false, true);
                return;
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.topicProblem() != TelegramBotApi.TopicProblem.MISSING
                        && failure.topicProblem() != TelegramBotApi.TopicProblem.CLOSED) {
                    throw failure;
                }
                store.changeStatus(request.id(), false, clock.instant());
            }
        }
        var title = ("telegram".equals(channel) ? "TG" : "VK") + " - " + name;
        title = title.substring(0, title.offsetByCodePoints(0, Math.min(128, title.codePointCount(0, title.length()))));
        var requestId = UUID.randomUUID().toString();
        var webTopic = "web:" + requestId;
        var prior = store.latestRequest(channel, chat);
        var reusable = prior == null || EmergencyOperatorInbox.isWebTopic(prior.topic()) ? null : prior.topic();
        request = new TelegramStore.Request(requestId, chat, webTopic, true, channel);
        store.open(request, name, clock.instant());
        store.recordMessage(requestId, "client_to_operator", message, name, text, clock.instant());
        store.usageEvent("new-request:" + requestId, "new_request", channel, requestId, clock.instant());
        String topic;
        try {
            topic = inbox.open(requestId, message, title, reusable);
        } catch (DurableTelegramInbox.UnknownOutcome uncertain) {
            recordWebTakeover(request);
            store.acknowledge(request, DELAYED, clock.instant());
            return;
        }
        if (!webTopic.equals(topic)) {
            switchOperatorTopic(requestId, webTopic, topic);
            request = new TelegramStore.Request(requestId, chat, topic, true, channel);
        } else {
            recordWebTakeover(request);
        }
        relayChunks(request, message, name, text, true, true);
    }

    private boolean relayChunks(TelegramStore.Request request, String message, String sender, String text, boolean initial, boolean notify)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        store.recordMessage(request.id(), "client_to_operator", message, sender, text, clock.instant());
        var topic = request.topic();
        var key = DurableTelegramInbox.relayKey(request.id(), topic, message, 0, initial);
        var firstAttempt = store.operatorActions().attempt(key.id());
        var initialRelay = firstAttempt == null ? initial : firstAttempt.initial();
        var chunks = chunks(request.channel(), sender, text, initialRelay);
        for (int index = 0; index < chunks.size(); index++) {
            inbox.prepareRelay(request.id(), topic, message, index, initialRelay);
        }
        boolean uncertain = false;
        for (int index = 0; index < chunks.size(); index++) {
            OperatorInbox.Relay sent;
            try {
                sent = inbox.relay(request.id(), topic, message, index, initialRelay, chunks.get(index));
            } catch (DurableTelegramInbox.UnknownOutcome unknown) {
                uncertain = true;
                continue;
            }
            if (!topic.equals(sent.topic())) {
                if (uncertain) {
                    break;
                }
                switchOperatorTopic(request.id(), topic, sent.topic());
                topic = sent.topic();
                if (EmergencyOperatorInbox.isWebTopic(topic)) {
                    recordWebTakeover(request);
                }
            }
            store.link(request.id(), "client_to_operator", message, sent.messageId(), clock.instant());
        }
        if (notify && !uncertain) {
            store.acknowledge(request, EmergencyOperatorInbox.isWebTopic(topic) ? DELAYED : ACKNOWLEDGEMENT, clock.instant());
        }
        return !uncertain;
    }

    void recoverWebRequests() throws SQLException, InterruptedException, IOException {
        IOException failure = null;
        for (var id : store.recoverableWebRequests()) {
            var request = store.byId(id);
            try {
                queue.run(request.channel(), request.conversation(), () -> recoverWebRequest(id));
            } catch (IOException failed) {
                if (failure == null) {
                    failure = new IOException("One or more web requests could not be recovered");
                }
                failure.addSuppressed(failed);
            }
        }
        if (failure != null) {
            throw failure;
        }
    }

    private void recoverWebRequest(String id) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.byId(id);
        if (request == null || !request.active() || !EmergencyOperatorInbox.isWebTopic(request.topic()) || store.hasWebReply(id)) {
            return;
        }
        var messages = store.recoveryMessages(id);
        if (messages.isEmpty()) {
            return;
        }
        var first = messages.getFirst();
        var title = ("telegram".equals(request.channel()) ? "TG" : "VK") + " - " + first.name();
        title = title.substring(0, title.offsetByCodePoints(0, Math.min(128, title.codePointCount(0, title.length()))));
        String topic;
        try {
            topic = inbox.open(id, first.event(), title, null);
        } catch (DurableTelegramInbox.UnknownOutcome uncertain) {
            return;
        }
        if (EmergencyOperatorInbox.isWebTopic(topic) || store.hasWebReply(id)) {
            return;
        }
        if (!store.recoverWebRequest(id, request.topic(), topic)) {
            inbox.lifecycle(topic, id, "recovery-conflict:" + topic, false);
            return;
        }
        var target = new TelegramStore.Request(id, request.conversation(), topic, true, request.channel());
        boolean complete = true;
        try {
            for (int index = 0; index < messages.size(); index++) {
                var message = messages.get(index);
                complete &= relayChunks(target, message.event(), message.name(), message.text(), index == 0, false);
            }
        } catch (TelegramBotApi.RequestFailed definiteFailure) {
            if (complete) {
                switchOperatorTopic(id, topic, request.topic());
            }
            throw definiteFailure;
        }
        if (complete) {
            store.acknowledge(request, RECOVERED, clock.instant());
        }
    }

    private void switchOperatorTopic(String request, String current, String next) throws SQLException {
        if (!store.switchTopic(request, current, next)) {
            var stored = store.byId(request);
            if (stored == null || !stored.topic().equals(next)) {
                throw new SQLException("Operator inbox changed concurrently");
            }
        }
    }

    private static List<String> chunks(String channel, String sender, String text, boolean initial) {
        var platform = "telegram".equals(channel) ? "Telegram" : "VK";
        var prefix = initial ? "Новое обращение из " + platform + "\nОтправитель: " + sender
                + "\n\nОтветьте сообщением в этой теме.\nЧтобы закрыть обращение, отправьте /close.\n\nВопрос:\n" : "Сообщение:\n\n";
        var messages = new ArrayList<String>();
        for (int start = 0; start < text.length();) {
            var capacity = MESSAGE_LIMIT - prefix.codePointCount(0, prefix.length());
            var size = Math.min(text.codePointCount(start, text.length()), capacity);
            var end = text.offsetByCodePoints(start, size);
            messages.add(prefix + text.substring(start, end));
            start = end;
            prefix = "Новое сообщение:\n\n";
        }
        return messages;
    }

    private void recordWebTakeover(TelegramStore.Request request) throws SQLException {
        store.usageEvent("web-takeover:" + request.id(), "web_takeover", request.channel(), request.id(), clock.instant());
    }

    void reconcileTopic(long topic, String event, boolean active, java.time.Instant occurred)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (!store.claim("operator:telegram", event, clock.instant())) {
            return;
        }
        var request = store.byTopic(topic);
        if (request != null) {
            queue.run(request.channel(), request.conversation(),
                    () -> reconcileCurrentTopic(store.byId(request.id()), request.topic(), event, active, occurred));
        }
        store.completeEvent("operator:telegram", event, clock.instant());
    }

    private void reconcileCurrentTopic(TelegramStore.Request request, String expectedTopic, String event,
            boolean active, java.time.Instant occurred) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (request != null && request.topic().equals(expectedTopic) && store.topicEventIsCurrent(request.id(), occurred)) {
            if (active && !store.canReopen(request)) {
                lifecycle(request, event, false);
            } else {
                if (request.active() != active) {
                    store.changeStatus(request.id(), active, occurred);
                }
                store.operatorActions().observeLifecycle(request.id(), request.topic(), active, occurred);
            }
        }
    }

    void relayReply(long topic, long message, String text, String event)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.byTopic(topic);
        if (request != null) {
            queue.run(request.channel(), request.conversation(), () -> {
                var current = store.byId(request.id());
                if (current != null && current.topic().equals(request.topic())) {
                    relayReply(current, Long.toString(message), text, event);
                }
            });
        }
    }

    void relayReply(TelegramStore.Request request, String message, String text, String event)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (request == null) {
            return;
        }
        var command = text.strip().split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        switch (command) {
            case "/close" -> {
                if (request.active()) {
                    lifecycle(request, event, false);
                }
            }
            case "/reopen" -> {
                if (store.canReopen(request)) {
                    lifecycle(request, event, true);
                } else {
                    lifecycle(request, event, false);
                }
            }
            default -> {
                if (request.active() || store.canReopen(request)) {
                    if (!request.active()) {
                        store.changeStatus(request.id(), true, clock.instant());
                        store.operatorActions().observeLifecycle(request.id(), request.topic(), true, clock.instant());
                    }
                    store.usageEvent("first-reply:" + request.id(), "first_reply", request.channel(), request.id(), clock.instant());
                    store.queue(request, event, message, text, clock.instant());
                }
            }
        }
    }

    private void lifecycle(TelegramStore.Request request, String event, boolean open)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        try {
            inbox.lifecycle(request.topic(), request.id(), event, open);
        } catch (DurableTelegramInbox.UnknownOutcome uncertain) {
            return;
        }
        store.changeStatus(request.id(), open, clock.instant());
        store.operatorActions().observeLifecycle(request.id(), request.topic(), open, clock.instant());
    }
}
