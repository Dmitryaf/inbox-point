package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Duration;

import com.inboxpoint.operations.ChannelActivity;
import com.inboxpoint.persistence.LocalJsonFile;
import com.inboxpoint.vk.VkChannel;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import tools.jackson.databind.json.JsonMapper;

final class VkSetup {
    private final Environment environment;
    private final Path path;
    private final URI origin;
    private final ChannelActivity activity = new ChannelActivity();
    private volatile VkChannel channel;
    private Thread poller;
    private String source = "none";

    VkSetup(Environment environment, Path database) {
        this.environment = environment;
        path = database.toAbsolutePath().resolveSibling("vk-settings.json");
        origin = URI.create(environment.getProperty("inboxpoint.vk.api-origin", "https://api.vk.com"));
    }

    synchronized void restore(VkChannel.Incoming sink) throws IOException, InterruptedException {
        if (environment.getProperty("VK_ENABLED", Boolean.class, false)) {
            var token = environment.getRequiredProperty("VK_ACCESS_TOKEN");
            var group = environment.getRequiredProperty("VK_GROUP_ID", Long.class);
            var timeout = environment.getProperty("VK_POLL_TIMEOUT_SECONDS", Integer.class, 25);
            start(token, group, timeout, false, sink);
            source = "environment";
            return;
        }
        try {
            var saved = JsonMapper.shared().readTree(Files.readString(path));
            if (!saved.isObject() || saved.size() != 3 || !saved.has("accessToken") || !saved.has("groupId") || !saved.has("pollTimeoutSeconds")) {
                throw new IOException("Invalid VK settings version");
            }
            start(saved.path("accessToken").asString(""), saved.path("groupId").asLong(0),
                    saved.path("pollTimeoutSeconds").asInt(0), false, sink);
            source = "local";
        } catch (NoSuchFileException missing) {
            source = "none";
        } catch (IOException | RuntimeException failure) {
            LoggerFactory.getLogger(VkSetup.class).warn("Saved VK connection could not be restored");
        }
    }

    synchronized void connect(String token, String community, VkChannel.Incoming sink)
            throws IOException, InterruptedException {
        if (channel != null) {
            throw new IllegalStateException("VK уже подключён.");
        }
        validate(token);
        try (var resolver = new VkChannel(origin, token)) {
            start(token, resolver.resolve(community), 25, true, sink);
            source = "local";
        }
    }

    private void start(String token, long group, int timeout, boolean save, VkChannel.Incoming sink)
            throws IOException, InterruptedException {
        validate(token);
        if (group <= 0 || group >= (1L << 53) || timeout < 1 || timeout > 25) {
            throw new IllegalArgumentException("Проверьте токен и сообщество VK.");
        }
        if (channel != null) {
            return;
        }
        var client = new VkChannel(origin, token);
        try {
            if (save) {
                client.check(group);
                LocalJsonFile.write(path, JsonMapper.shared().createObjectNode()
                        .put("accessToken", token).put("groupId", group).put("pollTimeoutSeconds", timeout));
            }
        } catch (IOException | InterruptedException | RuntimeException failure) {
            client.close();
            throw failure;
        }
        channel = client;
        poller = Thread.ofVirtual().name("vk-handoff").start(() -> {
            try {
                client.poll(group, timeout, sink, activity);
            } catch (InterruptedException stopping) {
                Thread.currentThread().interrupt();
            } catch (IOException | SQLException failure) {
                LoggerFactory.getLogger(VkSetup.class).warn("VK polling stopped");
            }
        });
    }

    private static void validate(String token) {
        if (token.length() < 20 || token.length() > 500) {
            throw new IllegalArgumentException("Проверьте токен сообщества VK.");
        }
    }

    synchronized TelegramRuntime.Status status() {
        var connected = poller != null && poller.isAlive();
        return new TelegramRuntime.Status(connected, "environment".equals(source) || channel != null, source);
    }

    ChannelActivity.Snapshot pollActivity() {
        return activity.snapshot();
    }

    VkChannel channel() {
        return channel;
    }

    synchronized void stop() throws InterruptedException {
        if (poller != null) {
            poller.interrupt();
            poller.join(Duration.ofSeconds(2));
        }
        if (channel != null) {
            channel.close();
            channel = null;
        }
    }
}
