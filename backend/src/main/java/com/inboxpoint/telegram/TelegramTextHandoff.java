package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;

import tools.jackson.databind.JsonNode;

final class TelegramTextHandoff {
    record OperatorChat(long id, boolean isForum, String title, String type) { }

    private final long operatorGroup;
    private final TelegramStore store;
    private final TelegramBotApi api;
    private final Clock clock;

    TelegramTextHandoff(long operatorGroup, TelegramStore store, TelegramBotApi api, Clock clock) {
        this.operatorGroup = operatorGroup;
        this.store = store;
        this.api = api;
        this.clock = clock;
    }

    void process(JsonNode update) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var message = update.path("message");
        var sender = message.path("from");
        var text = message.path("text").asString("");
        if (sender.isMissingNode() || sender.path("is_bot").asBoolean(false) || text.isBlank()) {
            return;
        }
        var type = message.at("/chat/type").asString("");
        var chat = message.at("/chat/id").asLong(0);
        var topic = message.path("message_thread_id").asLong(0);
        var externalMessage = message.path("message_id").asLong(0);
        boolean operator = chat == operatorGroup && topic > 0 && "supergroup".equals(type);
        if (externalMessage <= 0 || (!operator && (chat <= 0 || !"private".equals(type)))) {
            return;
        }
        var source = operator ? "operator:telegram" : "client:telegram";
        var event = Long.toString(update.path("update_id").asLong());
        if (!store.claim(source, event, clock.instant())) {
            return;
        }
        try {
            if (operator) {
                relayReply(topic, externalMessage, text, event);
            } else {
                relayQuestion(chat, externalMessage, text, sender);
            }
        } catch (TelegramBotApi.RequestFailed failure) {
            if (!failure.outcomeUnknown()) {
                store.release(source, event);
            }
            throw failure;
        }
    }

    private void relayQuestion(long chat, long message, String text, JsonNode sender)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.activeRequest(chat);
        var body = "Customer:\n\n" + text;
        if (request == null) {
            var name = (sender.path("first_name").asString("") + " " + sender.path("last_name").asString(""))
                    .strip().replaceAll("\\s+", " ");
            if (name.isEmpty()) {
                var username = sender.path("username").asString("");
                name = username.isEmpty() ? "Customer" : "@" + username;
            }
            var title = "TG - " + name;
            title = title.substring(0, title.offsetByCodePoints(0, Math.min(128, title.codePointCount(0, title.length()))));
            request = new TelegramStore.Request(UUID.randomUUID().toString(), chat,
                    api.createForumTopic(operatorGroup, title), true);
            store.open(request, clock.instant());
            body = "New Telegram request\nCustomer: " + name + "\nRequest: " + request.id() + "\n\n" + text
                    + "\n\nReply here to answer the customer. Use /close to close the request.";
        }
        var sent = api.sendMessage(operatorGroup, request.topic(), body);
        store.link(request.id(), "client_to_operator", message, sent, clock.instant());
    }

    private void relayReply(long topic, long message, String text, String event)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.byTopic(topic);
        if (request == null) {
            return;
        }
        var command = text.strip().split("[\\s@]", 2)[0].toLowerCase(Locale.ROOT);
        switch (command) {
            case "/close" -> {
                if (request.active()) {
                    api.closeTopic(operatorGroup, topic);
                    store.changeStatus(request.id(), false, clock.instant());
                }
            }
            case "/reopen" -> {
                if (!request.active() && store.activeRequest(request.conversation()) == null) {
                    api.reopenTopic(operatorGroup, topic);
                    store.changeStatus(request.id(), true, clock.instant());
                }
            }
            default -> {
                if (request.active()) {
                    var key = store.queue(request, event, text, clock.instant());
                    try {
                        var sent = api.sendMessage(request.conversation(), null, text);
                        store.deliver(key, sent, clock.instant());
                        store.link(request.id(), "operator_to_client", sent, message, clock.instant());
                    } catch (TelegramBotApi.RequestFailed failure) {
                        store.failed(key);
                        throw failure;
                    }
                }
            }
        }
    }
}
