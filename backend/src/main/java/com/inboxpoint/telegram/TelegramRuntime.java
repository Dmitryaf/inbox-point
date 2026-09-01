package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

import com.inboxpoint.persistence.LocalJsonFile;
import jakarta.annotation.PreDestroy;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
final class TelegramRuntime {
    private static final String NONE = "none";
    private static final String ENVIRONMENT = "environment";
    private static final String LOCAL = "local";
    private static final Duration API_TIMEOUT = Duration.ofSeconds(8);

    private final Environment environment;
    private final Path database;
    private final Path settingsFile;
    private final URI origin;
    private Thread poller;
    private String source = NONE;

    TelegramRuntime(Environment environment) {
        this.environment = environment;
        database = Path.of(environment.getProperty("DATABASE_PATH", "./data/messenger-handoff.sqlite"));
        settingsFile = database.toAbsolutePath().resolveSibling("telegram-settings.json");
        origin = URI.create(environment.getProperty("inboxpoint.telegram.api-origin", "https://api.telegram.org"));
    }

    @EventListener(ApplicationReadyEvent.class)
    synchronized void start() throws IOException, SQLException, InterruptedException {
        if (environment.getProperty("TELEGRAM_ENABLED", Boolean.class, false)) {
            source = ENVIRONMENT;
            var config = new Settings(environment.getRequiredProperty("TELEGRAM_BOT_TOKEN"),
                    environment.getRequiredProperty("TELEGRAM_OPERATOR_CHAT_ID", Long.class),
                    environment.getProperty("TELEGRAM_POLL_TIMEOUT_SECONDS", Integer.class, 30));
            startWorker(config, false);
            return;
        }
        try {
            var stored = JsonMapper.shared().readTree(Files.readString(settingsFile));
            if (stored.path("version").asInt(0) != 1) {
                throw new IllegalArgumentException("Unsupported settings version");
            }
            source = LOCAL;
            startWorker(new Settings(stored.path("botToken").asString(""), stored.path("operatorChatId").asLong(0),
                    stored.path("pollTimeoutSeconds").asInt(0)), false);
        } catch (NoSuchFileException missing) {
            source = NONE;
        } catch (IOException | SQLException | RuntimeException failure) {
            LoggerFactory.getLogger(TelegramRuntime.class).warn("Saved Telegram connection could not be restored");
        }
    }

    synchronized Status status() {
        var running = poller != null && poller.isAlive();
        return new Status(running, running || ENVIRONMENT.equals(source), source);
    }

    synchronized List<TelegramTextHandoff.OperatorChat> discover(String token)
            throws IOException, InterruptedException {
        assertMutable();
        validateToken(token);
        try (var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            return new TelegramBotApi(transport, origin, token, API_TIMEOUT).discoverChats();
        }
    }

    synchronized void connect(String token, long group) throws IOException, SQLException, InterruptedException {
        assertMutable();
        startWorker(new Settings(token, group, 30), true);
        source = LOCAL;
    }

    private void assertMutable() {
        if (ENVIRONMENT.equals(source)) {
            throw new IllegalStateException("Telegram is managed by server configuration");
        }
        if (poller != null && poller.isAlive()) {
            throw new IllegalStateException("Telegram is already connected");
        }
    }

    private static void validateToken(String token) {
        if (!token.matches("[0-9]+:[A-Za-z0-9_-]+") || token.length() < 20 || token.length() > 200) {
            throw new IllegalArgumentException("Invalid Telegram bot token format");
        }
    }

    private void startWorker(Settings settings, boolean save) throws IOException, SQLException, InterruptedException {
        validateToken(settings.token());
        if (settings.group() >= 0 || settings.group() <= -(1L << 53) || settings.timeout() < 1
                || settings.timeout() > 50) {
            throw new IllegalArgumentException("Invalid Telegram runtime settings");
        }
        verifyConnection(origin, settings.token(), settings.group());
        try (var store = new TelegramStore(database)) {
            if (save) {
                LocalJsonFile.write(settingsFile, JsonMapper.shared().createObjectNode().put("version", 1)
                        .put("botToken", settings.token()).put("operatorChatId", settings.group())
                        .put("pollTimeoutSeconds", settings.timeout()));
            }
        }
        poller = Thread.ofVirtual().name("telegram-handoff")
                .start(() -> poll(database, origin, settings.token(), settings.group(), settings.timeout()));
    }

    static void verifyConnection(URI origin, String token, long group) throws IOException, InterruptedException {
        try (var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            new TelegramBotApi(transport, origin, token, API_TIMEOUT).verifySetup(group);
        }
    }

    @PreDestroy
    synchronized void stop() throws InterruptedException {
        if (poller != null) {
            poller.interrupt();
            poller.join(Duration.ofSeconds(2));
        }
    }

    private static void poll(Path database, URI origin, String token, long group, int timeout) {
        try (var store = new TelegramStore(database); var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            var api = new TelegramBotApi(transport, origin, token, API_TIMEOUT);
            var handoff = new TelegramTextHandoff(group, store, api, Clock.systemUTC());
            Long next = null;
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    for (var update : api.getUpdates(next, timeout)) {
                        handoff.process(update);
                        var newOffset = update.path("update_id").asLong() + 1;
                        next = next == null ? newOffset : Math.max(next, newOffset);
                    }
                    Thread.sleep(100);
                } catch (TelegramBotApi.RequestFailed failure) {
                    LoggerFactory.getLogger(TelegramRuntime.class).warn("Telegram polling or relay failed");
                    Thread.sleep(1000);
                }
            }
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IOException | SQLException failure) {
            LoggerFactory.getLogger(TelegramRuntime.class).warn("Telegram storage could not start or continue");
        }
    }

    record Status(boolean connected, boolean locked, String source) { }

    private record Settings(String token, long group, int timeout) { }
}
