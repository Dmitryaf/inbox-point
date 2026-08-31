package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;

import jakarta.annotation.PreDestroy;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
final class TelegramRuntime {
    private final Environment environment;
    private Thread poller;

    TelegramRuntime(Environment environment) {
        this.environment = environment;
    }

    @EventListener(ApplicationReadyEvent.class)
    void start() throws IOException, InterruptedException {
        if (!environment.getProperty("TELEGRAM_ENABLED", Boolean.class, false)) {
            return;
        }
        var token = environment.getRequiredProperty("TELEGRAM_BOT_TOKEN");
        var group = environment.getRequiredProperty("TELEGRAM_OPERATOR_CHAT_ID", Long.class);
        int timeout = environment.getProperty("TELEGRAM_POLL_TIMEOUT_SECONDS", Integer.class, 30);
        if (!token.matches("[0-9]+:[A-Za-z0-9_-]+") || group >= 0 || timeout < 1 || timeout > 50) {
            throw new IllegalArgumentException("Invalid Telegram runtime settings");
        }
        var database = Path.of(environment.getProperty("DATABASE_PATH", "./data/messenger-handoff.sqlite"));
        var origin = URI.create(environment.getProperty("inboxpoint.telegram.api-origin", "https://api.telegram.org"));
        verifyConnection(origin, token, group);
        poller = Thread.ofVirtual().name("telegram-handoff").start(() -> poll(database, origin, token, group, timeout));
    }

    static void verifyConnection(URI origin, String token, long group)
            throws IOException, InterruptedException {
        var timeout = Duration.ofSeconds(8);
        try (var transport = TelegramHttpTransport.open("", timeout)) {
            new TelegramBotApi(transport, origin, token, timeout).verifySetup(group);
        }
    }

    @PreDestroy
    void stop() throws InterruptedException {
        if (poller != null) {
            poller.interrupt();
            poller.join(Duration.ofSeconds(2));
        }
    }

    private static void poll(Path database, URI origin, String token, long group, int timeout) {
        var ioTimeout = Duration.ofSeconds(8);
        try (var store = new TelegramStore(database); var transport = TelegramHttpTransport.open("", ioTimeout)) {
            var api = new TelegramBotApi(transport, origin, token, ioTimeout);
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
}
