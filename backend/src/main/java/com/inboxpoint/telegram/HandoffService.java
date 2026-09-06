package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;

final class HandoffService {
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
                relayChunks(request, message, name, "Клиент:\n\n", text);
                return;
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.topicProblem() != TelegramBotApi.TopicProblem.MISSING
                        && failure.topicProblem() != TelegramBotApi.TopicProblem.CLOSED) {
                    throw failure;
                }
                store.changeStatus(request.id(), false, clock.instant());
            }
        }
        var latest = store.latestRequest(channel, chat);
        if (latest != null && (request == null || !latest.id().equals(request.id()))) {
            try {
                inbox.reopen(latest.topic());
                relayChunks(latest, message, name, "Клиент:\n\n", text);
                store.changeStatus(latest.id(), true, clock.instant());
                return;
            } catch (TelegramBotApi.RequestFailed failure) {
                if (failure.topicProblem() != TelegramBotApi.TopicProblem.MISSING
                        && failure.topicProblem() != TelegramBotApi.TopicProblem.CLOSED) {
                    throw failure;
                }
            }
        }
        var platform = "telegram".equals(channel) ? "Telegram" : "VK";
        var title = ("telegram".equals(channel) ? "TG" : "VK") + " - " + name;
        title = title.substring(0, title.offsetByCodePoints(0, Math.min(128, title.codePointCount(0, title.length()))));
        var requestId = UUID.randomUUID().toString();
        request = new TelegramStore.Request(requestId, chat, inbox.open(requestId, title), true, channel);
        store.open(request, name, clock.instant());
        var prefix = "Новое обращение из " + platform + "\nКлиент: " + name
                + "\n\nОтветьте сообщением в этой теме.\nЧтобы закрыть обращение, отправьте /close.\n\nВопрос:\n";
        relayChunks(request, message, name, prefix, text);
    }

    private void relayChunks(TelegramStore.Request request, String message, String sender, String firstPrefix, String text)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        store.recordMessage(request.id(), "client_to_operator", message, sender, text, clock.instant());
        var prefix = firstPrefix;
        for (int start = 0; start < text.length();) {
            var capacity = MESSAGE_LIMIT - prefix.codePointCount(0, prefix.length());
            var size = Math.min(text.codePointCount(start, text.length()), capacity);
            var end = text.offsetByCodePoints(start, size);
            var sent = inbox.relay(request.topic(), request.channel() + ":" + message, start, prefix + text.substring(start, end));
            store.link(request.id(), "client_to_operator", message, sent, clock.instant());
            start = end;
            prefix = "Клиент (продолжение):\n\n";
        }
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
                    store.queue(request, event, message, text, clock.instant());
                }
            }
        }
    }
}
