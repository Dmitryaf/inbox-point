package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Map;

import com.inboxpoint.vk.VkChannel;

public final class ChannelIdentityCommand {
    private ChannelIdentityCommand() { }

    public static int run(String[] args, Map<String, String> environment) {
        if (args.length != 3 || !java.util.Set.of("telegram", "vk").contains(args[1])) {
            System.err.println("Expected channel and confirmed identity.");
            return 1;
        }
        var channel = args[1];
        var database = Path.of(environment.getOrDefault("DATABASE_PATH", "./data/inbox-point.sqlite"));
        if (!Files.isRegularFile(database)) {
            System.err.println("An existing application database is required.");
            return 1;
        }
        try {
            var identity = verify(channel, environment);
            if (!identity.equals(args[2])) {
                System.err.println("Verified channel identity does not match the confirmation.");
                return 1;
            }
            try (var connection = DriverManager.getConnection("jdbc:sqlite:" + database.toAbsolutePath());
                    var statement = connection.createStatement()) {
                try (var version = statement.executeQuery("PRAGMA user_version")) {
                    if (!version.next() || version.getInt(1) != 17) {
                        return 1;
                    }
                }
                try (var save = connection.prepareStatement("""
                        INSERT INTO channel_connection_identities (channel, identity) VALUES (?, ?)
                        ON CONFLICT(channel) DO UPDATE SET identity = excluded.identity
                        WHERE channel_connection_identities.identity = excluded.identity
                        """)) {
                    save.setString(1, channel);
                    save.setString(2, identity);
                    return save.executeUpdate() == 1 ? 0 : 1;
                }
            }
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IllegalArgumentException | IOException | SQLException unavailable) {
            System.err.println("Could not verify the channel identity.");
        }
        return 1;
    }

    private static String verify(String channel, Map<String, String> environment) throws IOException, InterruptedException {
        if ("telegram".equals(channel)) {
            var group = Long.parseLong(environment.getOrDefault("TELEGRAM_OPERATOR_CHAT_ID", ""));
            var bot = TelegramRuntime.verifyConnection(URI.create("https://api.telegram.org"),
                    environment.getOrDefault("TELEGRAM_BOT_TOKEN", ""), group, environment.getOrDefault("TELEGRAM_PROXY_URL", ""));
            return "telegram:" + bot + ":" + group;
        }
        try (var vk = new VkChannel(URI.create("https://api.vk.com"), environment.getOrDefault("VK_ACCESS_TOKEN", ""))) {
            var group = vk.resolve(environment.getOrDefault("VK_GROUP_ID", ""));
            vk.check(group);
            return "vk:" + group;
        }
    }
}
