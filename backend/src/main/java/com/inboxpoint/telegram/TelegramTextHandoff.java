package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;
import java.util.List;
import java.util.function.Predicate;

import com.inboxpoint.content.ClientInformation;
import tools.jackson.databind.JsonNode;

final class TelegramTextHandoff {
    record OperatorChat(long id, boolean isForum, String title, String type) { }

    private static final List<String> UNSUPPORTED = List.of("animation", "audio", "contact", "dice", "document",
            "paid_media", "photo", "poll", "sticker", "story", "venue", "video", "video_note", "voice");
    static final String TEXT_ONLY = ClientMessages.UNSUPPORTED_CONTENT;

    private final long operatorGroup;
    private final TelegramStore store;
    private final TelegramBotApi api;
    private final Clock clock;
    private final TelegramClientMenu menu;
    private final ClientMessageQueue queue;
    private final HandoffService handoff;

    TelegramTextHandoff(long operatorGroup, TelegramStore store, TelegramBotApi api, Clock clock, ClientInformation information) {
        this(operatorGroup, store, api, clock, information, new ClientMessageQueue(), channel -> false);
    }

    TelegramTextHandoff(long operatorGroup, TelegramStore store, TelegramBotApi api, Clock clock,
            ClientInformation information, ClientMessageQueue queue, Predicate<String> paused) {
        this(operatorGroup, store, api, clock, information, queue, paused, new TelegramTopicsInbox(api, operatorGroup));
    }

    TelegramTextHandoff(long operatorGroup, TelegramStore store, TelegramBotApi api, Clock clock,
            ClientInformation information, ClientMessageQueue queue, Predicate<String> paused, OperatorInbox inbox) {
        this.queue = queue;
        this.handoff = new HandoffService(store, inbox, clock, queue);
        this.operatorGroup = operatorGroup;
        this.store = store;
        this.api = api;
        this.clock = clock;
        this.menu = new TelegramClientMenu(store, api, inbox, information, paused);
    }

    void process(JsonNode update) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var callback = update.path("callback_query");
        if (callback.isObject()) {
            var chat = callback.at("/message/chat/id").asLong(0);
            var sender = callback.at("/from/id").asLong(0);
            var id = callback.path("id").asString("");
            var action = callback.path("data").asString("");
            if (action.startsWith("enroll:") && !id.isBlank()) {
                var enrollment = action.substring(7);
                var message = callback.at("/message/message_id").asLong(0);
                var topic = callback.at("/message/message_thread_id").asLong(0);
                var status = "unavailable";
                if (chat == operatorGroup && "supergroup".equals(callback.at("/message/chat/type").asString(""))
                        && topic > 0 && message > 0 && sender > 0 && !callback.at("/from/is_bot").asBoolean(false)
                        && enrollment.matches("[A-Za-z0-9_-]{1,36}")) {
                    status = store.confirmEnrollment(enrollment, Long.toString(topic), Long.toString(message), clock.instant());
                }
                api.answerCallback(id, switch (status) {
                    case "pending" -> "Подтверждение отправляется клиенту.";
                    case "sent" -> "Подтверждение уже отправлено.";
                    case "failed" -> "Не удалось отправить подтверждение. Проверьте ошибку доставки.";
                    default -> "Эта запись больше недоступна для подтверждения.";
                });
                return;
            }
            if (chat > 0 && chat == sender && !id.isBlank() && action.length() <= 64
                    && "private".equals(callback.at("/message/chat/type").asString(""))) {
                queue.run("telegram", chat, () -> {
                    menu.handle(chat, "callback:" + id, "main".equals(action) ? "Меню" : "", action, clock.instant());
                    api.answerCallback(id, null);
                });
            }
            return;
        }
        var message = update.path("message");
        var type = message.at("/chat/type").asString("");
        var chat = message.at("/chat/id").asLong(0);
        var topic = message.path("message_thread_id").asLong(0);
        var externalMessage = message.path("message_id").asLong(0);
        boolean operator = chat == operatorGroup && topic > 0 && "supergroup".equals(type);
        var event = Long.toString(update.path("update_id").asLong());
        if (operator && (message.has("forum_topic_closed") || message.has("forum_topic_reopened"))) {
            var occurred = java.time.Instant.ofEpochSecond(message.path("date").asLong(0));
            handoff.reconcileTopic(topic, event, message.has("forum_topic_reopened"), occurred);
            return;
        }
        var sender = message.path("from");
        var text = message.path("text").asString("");
        if (sender.isMissingNode() || sender.path("is_bot").asBoolean(false)) {
            return;
        }
        if (externalMessage <= 0 || (!operator && (chat <= 0 || !"private".equals(type)))) {
            return;
        }
        if (UNSUPPORTED.stream().anyMatch(message::has)) {
            notifyUnsupported(chat, topic, event, operator);
            return;
        }
        if (text.isBlank()) {
            return;
        }
        if (operator) {
            processText(chat, topic, externalMessage, text, event, sender, true,
                    java.time.Instant.ofEpochSecond(message.path("date").asLong(0)));
        } else {
            queue.run("telegram", chat, () -> processText(chat, topic, externalMessage, text, event, sender, false, java.time.Instant.EPOCH));
        }
    }

    private void notifyUnsupported(long chat, long topic, String event, boolean operator)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var source = "telegram:unsupported";
        if (!store.claim(source, event, clock.instant())) {
            return;
        }
        try {
            api.sendMessage(chat, operator ? topic : null, operator
                    ? "Это сообщение не отправлено клиенту: сейчас поддерживаются только текстовые ответы." : TEXT_ONLY);
            store.completeEvent(source, event, clock.instant());
        } catch (TelegramBotApi.RequestFailed failure) {
            if (failure.outcomeUnknown()) {
                store.completeEvent(source, event, clock.instant());
            } else {
                store.release(source, event);
            }
            throw failure;
        }
    }

    private void processText(long chat, long topic, long externalMessage, String text, String event,
            JsonNode sender, boolean operator, java.time.Instant occurred) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (!operator && menu.handle(chat, event, text, clock.instant())) {
            return;
        }
        var source = operator ? "operator:telegram" : "client:telegram";
        if (!store.claim(source, event, clock.instant())) {
            return;
        }
        try {
            if (operator) {
                handoff.relayReply(topic, externalMessage, text, event, occurred);
            } else {
                handoff.relayQuestion("telegram", chat, Long.toString(externalMessage), text, displayName(sender));
            }
            store.completeEvent(source, event, clock.instant());
        } catch (TelegramBotApi.RequestFailed failure) {
            if (!failure.outcomeUnknown()) {
                store.release(source, event);
            } else {
                store.completeEvent(source, event, clock.instant());
            }
            throw failure;
        }
    }

    void processVk(String event, long peer, long message, String name, String text)
            throws SQLException, InterruptedException, IOException {
        handoff.processVk(event, peer, message, name, text);
    }

    private static String displayName(JsonNode sender) {
        var name = (sender.path("first_name").asString("") + " " + sender.path("last_name").asString(""))
                .strip().replaceAll("\\s+", " ");
        var username = sender.path("username").asString("");
        return !name.isEmpty() ? name : username.isEmpty() ? "Customer" : "@" + username;
    }

}
