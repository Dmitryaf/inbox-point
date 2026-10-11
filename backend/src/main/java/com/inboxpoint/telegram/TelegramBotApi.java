package com.inboxpoint.telegram;

import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;

import java.io.IOException;
import com.inboxpoint.operations.ApiFailure;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

final class TelegramBotApi {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final long MAX_SAFE_INTEGER = (1L << 53) - 1;

    private final TelegramHttpTransport transport;
    private final URI apiRoot;
    private final Duration requestTimeout;

    TelegramBotApi(HttpClient client, URI origin, String token, Duration requestTimeout) {
        this(TelegramHttpTransport.direct(client), origin, token, requestTimeout);
    }

    TelegramBotApi(TelegramHttpTransport transport, URI origin, String token, Duration requestTimeout) {
        if (!token.matches("[0-9]+:[A-Za-z0-9_-]+")) {
            throw new IllegalArgumentException("Invalid Telegram bot token format");
        }
        this.transport = transport;
        this.apiRoot = origin.resolve("/bot" + token + "/");
        this.requestTimeout = requestTimeout;
    }

    long verifySetup(long operatorChatId) throws RequestFailed, InterruptedException {
        var bot = call("getMe", JSON.createObjectNode(), requestTimeout, false);
        var botId = bot.path("id");
        var enabled = JSON.getNodeFactory().booleanNode(true);
        if (!isIdentifier(botId) || botId.longValue() == 0 || !enabled.equals(bot.path("is_bot"))) {
            throw invalidResponse("getMe", false);
        }
        var chat = call("getChat", JSON.createObjectNode().put("chat_id", operatorChatId), requestTimeout, false);
        var chatId = chat.path("id");
        if (!chatId.isIntegralNumber() || !chatId.canConvertToLong() || chatId.longValue() != operatorChatId) {
            throw invalidResponse("getChat", false);
        }
        if (!"supergroup".equals(chat.path("type").asString("")) || !enabled.equals(chat.path("is_forum"))) {
            throw new RequestFailed("Telegram operator chat must be a supergroup with Topics enabled", false);
        }

        var membership = call("getChatMember", JSON.createObjectNode().put("chat_id", operatorChatId)
                .put("user_id", botId.longValue()), requestTimeout, false);
        var role = membership.path("status").asString("");
        if (!"creator".equals(role) && !"administrator".equals(role)) {
            throw new RequestFailed("Telegram bot must be an operator group administrator", false);
        }
        if ("administrator".equals(role) && !enabled.equals(membership.path("can_manage_topics"))) {
            throw new RequestFailed("Telegram bot requires can_manage_topics", false);
        }

        var webhook = call("getWebhookInfo", JSON.createObjectNode(), requestTimeout, false).path("url");
        if (!webhook.isString()) {
            throw invalidResponse("getWebhookInfo", false);
        }
        if (!webhook.asString().isEmpty()) {
            throw new RequestFailed("Telegram webhook must be removed before long polling", false);
        }
        return botId.longValue();
    }

    List<TelegramTextHandoff.OperatorChat> discoverChats() throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("timeout", 0);
        payload.putArray("allowed_updates").add("message").add("my_chat_member");
        var updates = call("getUpdates", payload, requestTimeout, false);
        if (!updates.isArray()) {
            throw invalidResponse("getUpdates", false);
        }
        var byId = new LinkedHashMap<Long, TelegramTextHandoff.OperatorChat>();
        for (var update : updates) {
            var chat = update.has("my_chat_member") ? update.at("/my_chat_member/chat") : update.at("/message/chat");
            var type = chat.path("type").asString("");
            var id = chat.path("id");
            if (("group".equals(type) || "supergroup".equals(type)) && id.isIntegralNumber()
                    && id.canConvertToLong() && id.longValue() < 0 && id.longValue() >= -MAX_SAFE_INTEGER) {
                var title = chat.path("title").asString("Telegram group " + id.longValue());
                var isForum = JSON.getNodeFactory().booleanNode(true).equals(chat.path("is_forum"));
                byId.put(id.longValue(), new TelegramTextHandoff.OperatorChat(id.longValue(), isForum, title, type));
            }
        }
        return byId.values().stream().sorted(Comparator.comparing(TelegramTextHandoff.OperatorChat::title)).toList();
    }

    List<JsonNode> getUpdates(Long offset, int timeoutSeconds) throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("timeout", timeoutSeconds);
        payload.putArray("allowed_updates").add("message").add("callback_query");
        if (offset != null) {
            payload.put("offset", offset);
        }

        var result = call("getUpdates", payload, requestTimeout.plusSeconds(timeoutSeconds), false);
        if (!result.isArray()) {
            throw invalidResponse("getUpdates", false);
        }
        var updates = new ArrayList<JsonNode>(result.size());
        for (var update : result) {
            var updateId = update.path("update_id");
            if (!isIdentifier(updateId) || updateId.longValue() >= MAX_SAFE_INTEGER) {
                throw invalidResponse("getUpdates", false);
            }
            updates.add(update);
        }
        return List.copyOf(updates);
    }

    void answerCallback(String callbackId, String text) throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("callback_query_id", callbackId);
        if (text != null) {
            payload.put("text", text);
        }
        try {
            var result = call("answerCallbackQuery", payload, requestTimeout, false);
            if (!result.isBoolean() || !result.booleanValue()) {
                throw invalidResponse("answerCallbackQuery", false);
            }
        } catch (RequestFailed failure) {
            if (!failure.expiredCallback()) {
                throw failure;
            }
        }
    }

    long createForumTopic(long chatId, String name) throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("chat_id", chatId).put("name", name);
        return sideEffectResultId("createForumTopic", payload, "message_thread_id");
    }

    long sendMessage(long chatId, Long threadId, String text) throws RequestFailed, InterruptedException {
        return sendMessage(chatId, threadId, text, null);
    }

    long sendMessage(long chatId, Long threadId, String text, JsonNode replyMarkup)
            throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("chat_id", chatId).put("text", text);
        if (threadId != null) {
            payload.put("message_thread_id", threadId);
        }
        if (replyMarkup != null) {
            payload.set("reply_markup", replyMarkup);
        }
        return sideEffectResultId("sendMessage", payload, "message_id");
    }

    void editMessageReplyMarkup(long chatId, long messageId, JsonNode replyMarkup)
            throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("chat_id", chatId).put("message_id", messageId);
        payload.set("reply_markup", replyMarkup);
        var result = call("editMessageReplyMarkup", payload, requestTimeout, false);
        if ((!result.isBoolean() || !result.booleanValue()) && !result.isObject()) {
            throw invalidResponse("editMessageReplyMarkup", false);
        }
    }

    void closeTopic(long chatId, long threadId) throws RequestFailed, InterruptedException {
        try {
            changeTopic("closeForumTopic", chatId, threadId);
        } catch (RequestFailed failure) {
            if (failure.topicProblem() != TopicProblem.MISSING && failure.topicProblem() != TopicProblem.CLOSED) {
                throw failure;
            }
        }
    }

    void reopenTopic(long chatId, long threadId) throws RequestFailed, InterruptedException {
        try {
            changeTopic("reopenForumTopic", chatId, threadId);
        } catch (RequestFailed failure) {
            if (failure.topicProblem() != TopicProblem.ALREADY_OPEN) {
                throw failure;
            }
        }
    }

    private void changeTopic(String method, long chatId, long threadId) throws RequestFailed, InterruptedException {
        var payload = JSON.createObjectNode().put("chat_id", chatId).put("message_thread_id", threadId);
        var result = call(method, payload, requestTimeout, true);
        if (!result.isBoolean() || !result.booleanValue()) {
            throw invalidResponse(method, true);
        }
    }

    private long sideEffectResultId(String method, ObjectNode payload, String field)
            throws RequestFailed, InterruptedException {
        var id = call(method, payload, requestTimeout, true).path(field);
        if (!isIdentifier(id) || id.longValue() == 0) {
            throw invalidResponse(method, true);
        }
        return id.longValue();
    }

    private JsonNode call(String method, ObjectNode payload, Duration timeout, boolean sideEffect)
            throws RequestFailed, InterruptedException {
        var started = System.nanoTime();
        TelegramHttpTransport.Reply response;
        try {
            response = transport.post(apiRoot.resolve(method), payload.toString(), timeout);
        } catch (IOException failure) {
            throw new RequestFailed("Telegram transport failed for " + method, sideEffect, TopicProblem.OTHER,
                    false, false, ApiFailure.describe("telegram", method, "transport", started, null, null, failure));
        }

        var status = response.statusCode();
        JsonNode envelope;
        try {
            envelope = JSON.readTree(response.body());
        } catch (JacksonException failure) {
            throw invalidResponse(method, sideEffect, started, status);
        }
        var ok = envelope == null ? null : envelope.path("ok");
        if (ok == null || !ok.isBoolean()) {
            throw invalidResponse(method, sideEffect, started, status);
        }
        if (!ok.booleanValue()) {
            var errorCode = envelope.path("error_code").asInt(status);
            var definitive = status < 500 && status != 408 && errorCode < 500 && errorCode != 408;
            var description = definitive && errorCode == 400
                    ? envelope.path("description").asString("").toLowerCase(java.util.Locale.ROOT) : "";
            if ("editMessageReplyMarkup".equals(method) && description.contains("message is not modified")) {
                return JSON.getNodeFactory().booleanNode(true);
            }
            if ("editMessageReplyMarkup".equals(method) && description.contains("message is not modified")) {
                return JSON.getNodeFactory().booleanNode(true);
            }
            var invalidKeyboard = "sendMessage".equals(method)
                    && (description.contains("keyboard") || description.contains("button")
                        || description.contains("reply markup"));
            var expiredCallback = "answerCallbackQuery".equals(method)
                    && (description.contains("query is too old") || description.contains("query id is invalid"));
            throw new RequestFailed("Telegram rejected " + method + " with code " + errorCode, sideEffect && !definitive,
                    knownTopicProblem(description), invalidKeyboard, expiredCallback,
                    ApiFailure.describe("telegram", method, "api", started, status, errorCode, null));
        }
        if (status < 200 || status >= 300) {
            throw invalidResponse(method, sideEffect, started, status);
        }
        return envelope.path("result");
    }

    private static boolean isIdentifier(JsonNode value) {
        return value.isIntegralNumber() && value.canConvertToLong()
                && value.longValue() >= 0 && value.longValue() <= MAX_SAFE_INTEGER;
    }

    private static RequestFailed invalidResponse(String method, boolean sideEffect) {
        return invalidResponse(method, sideEffect, System.nanoTime(), null);
    }

    private static RequestFailed invalidResponse(String method, boolean sideEffect, long started, Integer status) {
        var kind = status != null && (status < 200 || status >= 300) ? "http" : "invalid_response";
        return new RequestFailed("Invalid Telegram response for " + method, sideEffect, TopicProblem.OTHER, false, false,
                ApiFailure.describe("telegram", method, kind, started, status, null, null));
    }

    private static TopicProblem knownTopicProblem(String normalized) {
        if (normalized.contains("topic_not_modified")) {
            return TopicProblem.ALREADY_OPEN;
        }
        if (normalized.contains("topic_closed")) {
            return TopicProblem.CLOSED;
        }
        if (normalized.contains("topic_deleted") || normalized.contains("topic_id_invalid")
                || normalized.contains("message thread not found")) {
            return TopicProblem.MISSING;
        }
        return TopicProblem.OTHER;
    }

    enum TopicProblem {
        OTHER, MISSING, CLOSED, ALREADY_OPEN
    }

    static final class RequestFailed extends ApiFailure {
        private final boolean outcomeUnknown;
        private final TopicProblem topicProblem;
        private final boolean invalidKeyboard;
        private final boolean expiredCallback;

        RequestFailed(String message, boolean outcomeUnknown) {
            this(message, outcomeUnknown, TopicProblem.OTHER, false, false, null);
        }

        private RequestFailed(String message, boolean outcomeUnknown, TopicProblem topicProblem,
                boolean invalidKeyboard, boolean expiredCallback, Diagnostic diagnostic) {
            super(message, diagnostic);
            this.outcomeUnknown = outcomeUnknown;
            this.topicProblem = topicProblem;
            this.invalidKeyboard = invalidKeyboard;
            this.expiredCallback = expiredCallback;
        }

        boolean outcomeUnknown() {
            return outcomeUnknown;
        }

        TopicProblem topicProblem() {
            return topicProblem;
        }

        boolean invalidKeyboard() {
            return invalidKeyboard;
        }

        boolean expiredCallback() {
            return expiredCallback;
        }
    }
}
