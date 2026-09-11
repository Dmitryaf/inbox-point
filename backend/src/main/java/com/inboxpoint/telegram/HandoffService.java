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
                relayChunks(request, message, name, text, false);
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
        request = new TelegramStore.Request(requestId, chat, webTopic, true, channel);
        store.open(request, name, clock.instant());
        store.recordMessage(requestId, "client_to_operator", message, name, text, clock.instant());
        store.usageEvent("new-request:" + requestId, "new_request", channel, requestId, clock.instant());
        String topic;
        try {
            topic = inbox.open(requestId, message, title);
        } catch (DurableTelegramInbox.UnknownOutcome uncertain) {
            recordWebTakeover(request);
            store.acknowledge(request, ACKNOWLEDGEMENT, clock.instant());
            return;
        }
        if (!webTopic.equals(topic)) {
            switchOperatorTopic(requestId, webTopic, topic);
            request = new TelegramStore.Request(requestId, chat, topic, true, channel);
        } else {
            recordWebTakeover(request);
        }
        relayChunks(request, message, name, text, true);
    }

    private void relayChunks(TelegramStore.Request request, String message, String sender, String text, boolean initial)
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
        if (!uncertain) {
            store.acknowledge(request, ACKNOWLEDGEMENT, clock.instant());
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

    void reconcileTopic(long topic, String event, boolean active) throws SQLException {
        if (!store.claim("operator:telegram", event, clock.instant())) {
            return;
        }
        var request = store.byTopic(topic);
        if (request != null && request.active() != active
                && (!active || store.activeRequest(request.channel(), request.conversation()) == null)) {
            store.changeStatus(request.id(), active, clock.instant());
        }
        store.completeEvent("operator:telegram", event, clock.instant());
    }

    void relayReply(long topic, long message, String text, String event)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.byTopic(topic);
        if (request != null) {
            relayReply(request, Long.toString(message), text, event);
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
                    inbox.close(request.topic());
                    store.changeStatus(request.id(), false, clock.instant());
                }
            }
            case "/reopen" -> {
                if (!request.active() && store.activeRequest(request.channel(), request.conversation()) == null) {
                    inbox.reopen(request.topic());
                    store.changeStatus(request.id(), true, clock.instant());
                }
            }
            default -> {
                if (request.active()) {
                    store.usageEvent("first-reply:" + request.id(), "first_reply", request.channel(), request.id(), clock.instant());
                    store.queue(request, event, message, text, clock.instant());
                }
            }
        }
    }
}
