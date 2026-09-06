package com.inboxpoint.telegram;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.Predicate;

import com.inboxpoint.content.ClientInformation;
import tools.jackson.databind.JsonNode;

final class TelegramTextHandoff {
    record OperatorChat(long id, boolean isForum, String title, String type) { }

    private static final int MESSAGE_LIMIT = 4096;
    private static final List<String> UNSUPPORTED = List.of("animation", "audio", "contact", "dice", "document",
            "paid_media", "photo", "poll", "sticker", "story", "venue", "video", "video_note", "voice");
    static final String TEXT_ONLY = "Сейчас можно отправить только текст. Напишите вопрос отдельным текстовым сообщением.";

    private final long operatorGroup;
    private final TelegramStore store;
    private final TelegramBotApi api;
    private final Clock clock;
    private final TelegramClientMenu menu;
    private final ClientMessageQueue queue;

    TelegramTextHandoff(long operatorGroup, TelegramStore store, TelegramBotApi api, Clock clock, ClientInformation information) {
        this(operatorGroup, store, api, clock, information, new ClientMessageQueue(), channel -> false);
    }

    TelegramTextHandoff(long operatorGroup, TelegramStore store, TelegramBotApi api, Clock clock,
            ClientInformation information, ClientMessageQueue queue, Predicate<String> paused) {
        this.queue = queue;
        this.operatorGroup = operatorGroup;
        this.store = store;
        this.api = api;
        this.clock = clock;
        this.menu = new TelegramClientMenu(store, api, operatorGroup, information, paused);
    }

    void process(JsonNode update) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var message = update.path("message");
        var type = message.at("/chat/type").asString("");
        var chat = message.at("/chat/id").asLong(0);
        var topic = message.path("message_thread_id").asLong(0);
        var externalMessage = message.path("message_id").asLong(0);
        boolean operator = chat == operatorGroup && topic > 0 && "supergroup".equals(type);
        var event = Long.toString(update.path("update_id").asLong());
        if (operator && (message.has("forum_topic_closed") || message.has("forum_topic_reopened"))) {
            reconcileTopic(topic, event, message.has("forum_topic_reopened"));
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
            processText(chat, topic, externalMessage, text, event, sender, true);
        } else {
            queue.run("telegram", chat, () -> processText(chat, topic, externalMessage, text, event, sender, false));
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
            JsonNode sender, boolean operator) throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        if (!operator && menu.handle(chat, event, text, clock.instant())) {
            return;
        }
        var source = operator ? "operator:telegram" : "client:telegram";
        if (!store.claim(source, event, clock.instant())) {
            return;
        }
        try {
            if (operator) {
                relayReply(topic, externalMessage, text, event);
            } else {
                relayQuestion("telegram", chat, Long.toString(externalMessage), text, displayName(sender));
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

    private static String displayName(JsonNode sender) {
        var name = (sender.path("first_name").asString("") + " " + sender.path("last_name").asString(""))
                .strip().replaceAll("\\s+", " ");
        var username = sender.path("username").asString("");
        return !name.isEmpty() ? name : username.isEmpty() ? "Customer" : "@" + username;
    }

    private void relayQuestion(String channel, long chat, String message, String text, String name)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var request = store.activeRequest(channel, chat);
        if (request != null) {
            try {
                relayChunks(request, message, "Клиент:\n\n", text);
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
                api.reopenTopic(operatorGroup, latest.topic());
                relayChunks(latest, message, "Клиент:\n\n", text);
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
        request = new TelegramStore.Request(UUID.randomUUID().toString(), chat,
                api.createForumTopic(operatorGroup, title), true, channel);
        store.open(request, clock.instant());
        var prefix = "Новое обращение из " + platform + "\nКлиент: " + name
                + "\n\nОтветьте сообщением в этой теме.\nЧтобы закрыть обращение, отправьте /close.\n\nВопрос:\n";
        relayChunks(request, message, prefix, text);
    }

    private void relayChunks(TelegramStore.Request request, String message, String firstPrefix, String text)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var prefix = firstPrefix;
        for (int start = 0; start < text.length();) {
            var capacity = MESSAGE_LIMIT - prefix.codePointCount(0, prefix.length());
            var size = Math.min(text.codePointCount(start, text.length()), capacity);
            var end = text.offsetByCodePoints(start, size);
            var sent = api.sendMessage(operatorGroup, request.topic(), prefix + text.substring(start, end));
            store.link(request.id(), "client_to_operator", message, Long.toString(sent), clock.instant());
            start = end;
            prefix = "Клиент (продолжение):\n\n";
        }
    }

    private void reconcileTopic(long topic, String event, boolean active) throws SQLException {
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
                if (!request.active() && store.activeRequest(request.channel(), request.conversation()) == null) {
                    api.reopenTopic(operatorGroup, topic);
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
