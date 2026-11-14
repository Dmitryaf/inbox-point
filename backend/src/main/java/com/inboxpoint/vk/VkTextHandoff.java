package com.inboxpoint.vk;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import com.inboxpoint.content.ClientCatalog;
import com.inboxpoint.content.ClientMenu;
import com.inboxpoint.content.ClientMenu.Button;
import com.inboxpoint.content.ClientMenu.Keyboard;
import com.inboxpoint.content.ClientMenu.Response;
import com.inboxpoint.handoff.ClientMessages;
import com.inboxpoint.handoff.OperatorHandoff;
import com.inboxpoint.operations.LocalServiceControl;
import com.inboxpoint.persistence.SqliteTextHandoff;
import com.inboxpoint.persistence.SqliteTextHandoff.ClientText;
import com.inboxpoint.persistence.SqliteTextHandoff.NativeOperatorText;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;

public final class VkTextHandoff {
    private static final String CHANNEL = "vk";
    private static final long FIRST_CHAT_PEER = 2_000_000_000;
    private static final long MAX_COMPATIBLE_TIMESTAMP = 8_640_000_000_000L;
    private static final JsonMapper JSON = JsonMapper.shared();

    private final SqliteTextHandoff store;
    private final VkApiClient api;
    private OperatorHandoff operator;
    private final LocalServiceControl control;
    private final Path settings;
    private final Clock clock;
    private final VkLongPoll poller;

    public VkTextHandoff(Path database, SqliteTextHandoff store, HttpClient http, URI origin, String token,
            long groupId, Duration timeout, OperatorHandoff operator, Clock clock)
            throws IOException, SQLException, InterruptedException {
        this.store = store;
        this.api = new VkApiClient(http, origin, token, timeout);
        this.operator = operator;
        this.control = new LocalServiceControl(database);
        this.settings = database.resolveSibling("content-settings.json");
        this.clock = clock;
        this.poller = VkLongPoll.connect(store, api, groupId, this::route, clock);
    }

    public VkLongPoll.Step step(int waitSeconds) throws IOException, SQLException, InterruptedException {
        return poller.step(waitSeconds);
    }

    public static String verifyIdentity(HttpClient http, URI origin, String token, long groupId, Duration timeout)
            throws IOException, InterruptedException {
        var api = new VkApiClient(http, origin, token, timeout);
        api.verifyReady(groupId);
        api.open(groupId);
        return Long.toString(groupId);
    }

    public static long resolveCommunity(HttpClient http, URI origin, String token, String reference, Duration timeout)
            throws IOException, InterruptedException {
        return new VkApiClient(http, origin, token, timeout).resolveConfiguredCommunity(reference);
    }

    public void setOperator(OperatorHandoff operator) {
        this.operator = operator;
    }

    public VkLongPoll.Step poll(SqliteTextHandoff inbox, int waitSeconds)
            throws IOException, SQLException, InterruptedException {
        return poller.poll(inbox, waitSeconds);
    }

    public boolean processNext() throws SQLException, InterruptedException {
        return poller.processNext();
    }

    public void sendPending() throws IOException, SQLException, InterruptedException {
        if (control.deliveryPaused()) {
            return;
        }
        for (var delivery : store.pendingDeliveries(CHANNEL, clock.instant())) {
            if (control.deliveryPaused()) {
                break;
            }
            long peer;
            try {
                peer = Long.parseLong(delivery.conversationId());
                if (peer <= 0 || peer >= FIRST_CHAT_PEER) {
                    throw new NumberFormatException();
                }
            } catch (NumberFormatException failure) {
                if (store.claimDelivery(delivery.id(), clock.instant())) {
                    store.failDelivery(delivery.id(), "Invalid stored VK destination", false, clock.instant());
                }
                continue;
            }
            var menu = menu();
            var state = store.menuState(CHANNEL, delivery.conversationId(), control.intakePaused(CHANNEL), clock.instant());
            var markup = keyboard(menu.mainRows(state), false);
            if (!store.claimDelivery(delivery.id(), clock.instant())) {
                continue;
            }
            String externalId;
            try {
                externalId = api.send(peer, delivery.text(), delivery.idempotencyKey(), markup);
            } catch (IOException failure) {
                store.failDelivery(delivery.id(), failure.getMessage(), !(failure instanceof VkApiClient.ApiError),
                        clock.instant());
                continue;
            }
            store.completeDelivery(delivery.id(), externalId, clock.instant());
        }
    }

    private void route(JsonNode event) throws IOException, SQLException, InterruptedException {
        var type = event.path("type").asString();
        if (!"message_new".equals(type) && !"message_reply".equals(type)) {
            return;
        }
        var object = event.path("object");
        var reply = "message_reply".equals(type);
        var message = reply && !object.has("message") ? object : object.path("message");
        var peer = number(message, "peer_id");
        var sender = number(message, "from_id");
        var apiMessageId = number(message, "id");
        var localId = message.has("conversation_message_id") ? number(message, "conversation_message_id") : apiMessageId;
        var timestamp = number(message, "date");
        var content = message.path("text");
        var attachments = message.path("attachments");
        var outgoing = message.has("out") && number(message, "out") == 1;
        if (!content.isString() || apiMessageId < 0 || localId < 0 || timestamp < 0
                || timestamp > MAX_COMPATIBLE_TIMESTAMP || (!attachments.isMissingNode() && !attachments.isArray())) {
            throw new IOException("Invalid VK message fields");
        }
        if (peer <= 0 || peer >= FIRST_CHAT_PEER) {
            return;
        }
        var text = content.asString();
        var chat = Long.toString(peer);
        var messageId = chat + ":" + localId;
        var eventId = event.path("event_id").asString("vk-message:" + messageId);
        var receivedAt = Instant.ofEpochSecond(timestamp);
        if (reply || outgoing) {
            if (message.has("admin_author_id") && number(message, "admin_author_id") > 0 && !text.isBlank()) {
                handleNativeReply(new NativeOperatorText(eventId, chat, messageId, text, receivedAt));
            }
            return;
        }
        if (peer != sender || store.hasHandledClientText(CHANNEL, eventId)
                || store.hasHandledMenuResponse(CHANNEL, eventId)) {
            return;
        }
        if (!attachments.isEmpty()) {
            api.send(peer, ClientMessages.UNSUPPORTED_CONTENT, "unsupported:" + eventId, null);
            store.completeMenuResponse(CHANNEL, eventId, clock.instant());
            return;
        }
        if (text.isBlank()) {
            return;
        }
        var now = clock.instant();
        var state = store.menuState(CHANNEL, chat, control.intakePaused(CHANNEL), now);
        var selection = menu().resolveVk(text, menuAction(message.path("payload")), state);
        if (selection.isPresent()) {
            var response = selection.get();
            if (store.prepareMenuResponse(CHANNEL, chat, eventId, response, now)) {
                sendMenu(peer, eventId, response);
                store.completeMenuResponse(CHANNEL, eventId, clock.instant());
            }
            return;
        }
        var client = new ClientText(CHANNEL, eventId, chat, messageId, api.userDisplayName(sender), text, receivedAt);
        if (operator == null) {
            store.acceptClientTextInWeb(client, now);
        } else {
            operator.relayClientText(client);
        }
    }

    private void handleNativeReply(NativeOperatorText text) throws IOException, SQLException, InterruptedException {
        var request = store.recordVkOperatorText(text, clock.instant());
        if (request.isPresent()) {
            if (operator != null) {
                operator.mirrorNativeReply(request.get(), text);
            }
            store.completeVkOperatorText(text.eventId(), clock.instant());
        }
    }

    private void sendMenu(long peer, String eventId, Response response) throws IOException, InterruptedException {
        var inline = response.keyboard() == Keyboard.INLINE;
        try {
            api.send(peer, response.text(), "vk-menu:" + eventId, keyboard(response.rows(), inline));
        } catch (VkApiClient.ApiError failure) {
            if (!inline || !failure.keyboardUnavailable()) {
                throw failure;
            }
            var texts = ClientMenu.inlineFallback(response);
            for (int index = 0; index < texts.size(); index++) {
                api.send(peer, texts.get(index), "vk-menu-fallback:" + eventId + ":" + index, null);
            }
        }
    }

    private ClientMenu menu() throws IOException {
        try {
            return new ClientMenu(ClientCatalog.load(settings));
        } catch (IllegalArgumentException failure) {
            throw new IOException("Could not load local client content settings");
        }
    }

    private static String menuAction(JsonNode payload) {
        if (payload.isString() && !payload.asString().isBlank()) {
            try {
                var decoded = JSON.readTree(payload.asString());
                return decoded == null ? null : decoded.path("action").asString(null);
            } catch (JacksonException ignored) {
                // A plain VK message need not contain button data.
            }
        }
        return null;
    }

    private static JsonNode keyboard(List<List<Button>> rows, boolean inline) {
        var markup = JSON.createObjectNode().put("inline", inline).put("one_time", false);
        var buttons = markup.putArray("buttons");
        for (var row : rows) {
            if (!inline && row.stream().allMatch(button -> button.action().startsWith("custom:"))) {
                for (var button : row) {
                    addButton(buttons.addArray(), button);
                }
            } else {
                var target = buttons.addArray();
                row.forEach(button -> addButton(target, button));
            }
        }
        return markup;
    }

    private static void addButton(ArrayNode row, Button button) {
        var primary = "handoff".equals(button.action()) || button.action().startsWith("classes:signup:");
        row.addObject().put("color", primary ? "primary" : "secondary").putObject("action")
                .put("type", "text").put("label", button.label())
                .put("payload", JSON.createObjectNode().put("action", button.action()).toString());
    }

    private static long number(JsonNode message, String field) throws IOException {
        var value = message.path(field);
        if (!value.isIntegralNumber() || !value.canConvertToLong()) {
            throw new IOException("Invalid VK message number: " + field);
        }
        return value.longValue();
    }
}
