package com.inboxpoint.vk;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import com.inboxpoint.operations.ChannelActivity;
import tools.jackson.databind.JsonNode;

public final class VkChannel implements AutoCloseable {
    private static final long FIRST_GROUP_CHAT = 2_000_000_000L;
    private final HttpClient http;
    private final VkApiClient api;
    private VkApiClient.Server initial;

    public VkChannel(URI origin, String token) {
        var timeout = Duration.ofSeconds(8);
        http = HttpClient.newBuilder().connectTimeout(timeout).proxy(HttpClient.Builder.NO_PROXY).build();
        api = new VkApiClient(http, origin, token, timeout);
    }

    public long resolve(String community) throws IOException, InterruptedException {
        return api.resolveConfiguredCommunity(community);
    }

    public long send(long peer, String text, String key) throws IOException, InterruptedException {
        return send(peer, text, key, null);
    }

    public long send(long peer, String text, String key, JsonNode keyboard) throws IOException, InterruptedException {
        return Long.parseLong(api.send(peer, text, key, keyboard));
    }

    public void check(long group) throws IOException, InterruptedException {
        api.verifyReady(group);
        initial = api.open(group);
    }

    public void poll(long group, int timeout, Incoming sink, ChannelActivity activity) throws IOException, SQLException, InterruptedException {
        var server = initial;
        var cursor = server == null ? null : server.initialCursor();
        while (!Thread.currentThread().isInterrupted()) {
            try {
                if (server == null) {
                    server = api.open(group);
                    cursor = server.initialCursor();
                }
                if (!sink.drain()) {
                    Thread.sleep(Duration.ofMillis(250));
                    continue;
                }
                switch (api.poll(server, cursor, timeout)) {
                    case VkApiClient.Batch batch -> {
                        var events = new ArrayList<Inbound>();
                        for (var update : batch.updates()) {
                            if (update.path("group_id").asLong() == group) {
                                events.add(new Inbound(eventId(update), update.toString()));
                            }
                        }
                        sink.save(events);
                        cursor = batch.cursor();
                        activity.succeeded();
                    }
                    case VkApiClient.Recovery recovery -> {
                        if (recovery.code() == 1 && recovery.cursor() != null) {
                            cursor = recovery.cursor();
                        } else if (recovery.code() == 2 || recovery.code() == 3) {
                            server = api.open(group);
                            cursor = server.initialCursor();
                        } else {
                            throw new IOException("VK Long Poll could not recover");
                        }
                    }
                }
            } catch (IOException failure) {
                activity.failed();
                Thread.sleep(Duration.ofSeconds(1));
            }
        }
    }

    public Message readQueued(Inbound item) throws IOException, InterruptedException {
        var stored = tools.jackson.databind.json.JsonMapper.shared().readTree(item.payload());
        if (stored == null || !stored.isObject()) {
            throw new IOException("Invalid stored VK update");
        }
        if (stored.has("event") && stored.path("peer").isIntegralNumber()) {
            return tools.jackson.databind.json.JsonMapper.shared().treeToValue(stored, Message.class);
        }
        if (!VkApiClient.isEvent(stored)) {
            throw new IOException("Invalid stored VK update");
        }
        if (!"message_new".equals(stored.path("type").asString())) {
            return null;
        }
        var message = messageNew(stored);
        var from = message.path("from_id").asLong();
        var peer = message.path("peer_id").asLong();
        var id = message.path("conversation_message_id").asLong(message.path("id").asLong());
        var text = message.path("text").asString();
        var unsupported = message.path("attachments").isArray() && !message.path("attachments").isEmpty();
        if (from != peer || peer <= 0 || peer >= FIRST_GROUP_CHAT || id <= 0 || !unsupported && text.isBlank()
                || message.path("out").asInt(0) != 0) {
            return null;
        }
        return new Message(item.event(), peer, id, unsupported ? "" : api.userDisplayName(peer), text, unsupported);
    }

    private static String eventId(JsonNode update) {
        var provided = update.path("event_id").asString("");
        if (!provided.isEmpty()) {
            return provided;
        }
        var message = update.at("/object/message");
        var peer = message.path("peer_id").asLong();
        var id = message.path("conversation_message_id").asLong(message.path("id").asLong());
        if (peer > 0 && id > 0) {
            return "vk-message:" + peer + ":" + id;
        }
        return "vk-update:" + java.util.UUID.nameUUIDFromBytes(update.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    static tools.jackson.databind.JsonNode messageNew(tools.jackson.databind.JsonNode update) throws IOException {
        var message = update.at("/object/message");
        if (!message.isObject() || !message.path("date").isIntegralNumber() || message.path("date").asLong() < 0
                || !message.path("from_id").isIntegralNumber() || !message.path("peer_id").isIntegralNumber()
                || !message.path("id").isIntegralNumber() || message.path("id").asLong() < 0
                || !message.path("text").isString() || !optionalNumber(message.path("out"))
                || !optionalNumber(message.path("conversation_message_id"))
                || message.path("conversation_message_id").asLong(0) < 0) {
            throw new IOException("Invalid VK message_new event");
        }
        var attachments = message.path("attachments");
        if (!attachments.isMissingNode()) {
            if (!attachments.isArray()) {
                throw new IOException("Invalid VK message_new attachments");
            }
            for (var attachment : attachments) {
                if (!attachment.path("type").isString()) {
                    throw new IOException("Invalid VK message_new attachment");
                }
            }
        }
        return message;
    }

    private static boolean optionalNumber(tools.jackson.databind.JsonNode value) {
        return value.isMissingNode() || value.isIntegralNumber();
    }

    @Override
    public void close() {
        http.close();
    }

    public record Message(String event, long peer, long message, String name, String text, boolean unsupported) {
        public Message(String event, long peer, long message, String name, String text) {
            this(event, peer, message, name, text, false);
        }
    }

    public record Inbound(String event, String payload) { }

    public interface Incoming {
        void save(List<Inbound> batch) throws SQLException, IOException;

        boolean drain() throws IOException, SQLException, InterruptedException;
    }
}
