package com.inboxpoint.vk;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.sql.SQLException;
import java.time.Duration;

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
        initial = api.open(group);
    }

    public void poll(long group, int timeout, Incoming sink) throws IOException, SQLException, InterruptedException {
        var server = initial == null ? api.open(group) : initial;
        var cursor = server.initialCursor();
        while (!Thread.currentThread().isInterrupted()) {
            try {
                switch (api.poll(server, cursor, timeout)) {
                    case VkApiClient.Batch batch -> {
                        for (var update : batch.updates()) {
                            if (update.path("group_id").asLong() != group
                                    || !"message_new".equals(update.path("type").asString(""))) {
                                continue;
                            }
                            var message = update.at("/object/message");
                            long from = message.path("from_id").asLong();
                            long peer = message.path("peer_id").asLong();
                            long id = message.path("conversation_message_id").asLong(message.path("id").asLong());
                            var text = message.path("text").asString("");
                            if (from == peer && peer > 0 && peer < FIRST_GROUP_CHAT && id > 0 && !text.isBlank()
                                    && message.path("out").asInt(0) == 0) {
                                var event = update.path("event_id").asString("vk-message:" + peer + ":" + id);
                                sink.receive(event, peer, id, api.userDisplayName(peer), text);
                            }
                        }
                        cursor = batch.cursor();
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
                Thread.sleep(Duration.ofSeconds(1));
            }
        }
    }

    @Override
    public void close() {
        http.close();
    }

    @FunctionalInterface
    public interface Incoming {
        void receive(String event, long peer, long message, String name, String text)
                throws IOException, SQLException, InterruptedException;
    }
}
