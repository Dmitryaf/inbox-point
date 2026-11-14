package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.Locale;

import com.inboxpoint.persistence.LocalJsonFile;
import org.springframework.core.env.Environment;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class ChannelSettings {
    private static final long MAX_SAFE_INTEGER = (1L << 53) - 1;

    static Selection read(Path database, Environment environment, String channel) {
        var telegram = "telegram".equals(channel);
        var prefix = channel.toUpperCase(Locale.ROOT) + "_";
        var flag = environment.getProperty(prefix + "ENABLED", "false");
        if ("true".equals(flag)) {
            var token = environment.getProperty(prefix + (telegram ? "BOT_TOKEN" : "ACCESS_TOKEN"), "");
            var id = environment.getProperty(prefix + (telegram ? "OPERATOR_CHAT_ID" : "GROUP_ID"), "");
            var timeout = environment.getProperty(prefix + "POLL_TIMEOUT_SECONDS", telegram ? "30" : "25");
            try {
                return new Selection(true, config(token, Long.parseLong(id), Integer.parseInt(timeout), telegram));
            } catch (IllegalArgumentException invalid) {
                return new Selection(true, null);
            }
        }
        if (!"false".equals(flag)) {
            return new Selection(true, null);
        }
        try {
            var file = database.resolveSibling(channel + "-settings.json");
            var root = JsonMapper.shared().readTree(Files.readString(file));
            var token = telegram ? "botToken" : "accessToken";
            var id = telegram ? "operatorChatId" : "groupId";
            if (root == null || !root.isObject() || root.size() != 3 || !root.path(token).isString()) {
                return new Selection(true, null);
            }
            return new Selection(true, config(root.path(token).asString(), integer(root.path(id)),
                    Math.toIntExact(integer(root.path("pollTimeoutSeconds"))), telegram));
        } catch (NoSuchFileException absent) {
            return new Selection(false, null);
        } catch (IOException | JacksonException | IllegalArgumentException | ArithmeticException invalid) {
            return new Selection(true, null);
        }
    }

    private static Config config(String token, long id, int timeout, boolean telegram) {
        var validId = telegram ? id < 0 && id >= -MAX_SAFE_INTEGER : id > 0 && id <= MAX_SAFE_INTEGER;
        if (token.length() < 20 || token.isBlank() || !validId || timeout < 1 || timeout > 50) {
            throw new IllegalArgumentException("Invalid channel configuration");
        }
        return new Config(token, id, timeout);
    }

    static void save(Path database, String channel, Config config) throws IOException {
        var telegram = "telegram".equals(channel);
        var settings = JsonMapper.shared().createObjectNode().put(telegram ? "botToken" : "accessToken", config.token())
                .put(telegram ? "operatorChatId" : "groupId", config.id()).put("pollTimeoutSeconds", config.pollSeconds());
        LocalJsonFile.write(database.resolveSibling(channel + "-settings.json"), settings);
    }

    static void clear(Path database, String channel) throws IOException {
        Files.deleteIfExists(database.resolveSibling(channel + "-settings.json"));
    }

    private static long integer(JsonNode node) {
        if (!node.isIntegralNumber() || !node.canConvertToLong()) {
            throw new IllegalArgumentException("Invalid channel number");
        }
        return node.longValue();
    }

    record Selection(boolean configured, Config config) { }

    record Config(String token, long id, int pollSeconds) {
        @Override
        public String toString() {
            return "Channel configuration";
        }
    }
}
