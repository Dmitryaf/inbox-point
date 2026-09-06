package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.List;
import java.util.Map;

import com.inboxpoint.content.ClientInformation;
import com.inboxpoint.operations.ChannelActivity;
import com.inboxpoint.operations.LocalServiceControl;
import com.inboxpoint.vk.VkChannel;
import com.inboxpoint.persistence.LocalJsonFile;
import jakarta.annotation.PreDestroy;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public final class TelegramRuntime {
    private static final String NONE = "none";
    private static final String ENVIRONMENT = "environment";
    private static final String LOCAL = "local";
    private static final Duration API_TIMEOUT = Duration.ofSeconds(8);

    private final Environment environment;
    private final ClientInformation information;
    private final LocalServiceControl serviceControl;
    private final ClientMessageQueue queue = new ClientMessageQueue();
    private final Path database;
    private final Path settingsFile;
    private final URI origin;
    private Thread poller;
    private Thread deliveries;
    private volatile Instant lastDeliveryCycle;
    private final VkSetup vk;
    private final ChannelActivity activity = new ChannelActivity();
    private volatile Settings live;
    private String source = NONE;

    TelegramRuntime(Environment environment, ClientInformation information) {
        this.information = information;
        this.environment = environment;
        database = Path.of(environment.getProperty("DATABASE_PATH", "./data/messenger-handoff.sqlite"));
        serviceControl = new LocalServiceControl(database);
        settingsFile = database.toAbsolutePath().resolveSibling("telegram-settings.json");
        origin = URI.create(environment.getProperty("inboxpoint.telegram.api-origin", "https://api.telegram.org"));
        vk = new VkSetup(environment, database);
    }

    @EventListener(ApplicationReadyEvent.class)
    synchronized void start() throws IOException, SQLException, InterruptedException {
        try (var store = new TelegramStore(database)) {
            store.recoverInterrupted();
        }
        vk.restore(incomingVk());
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

    private VkChannel.Incoming incomingVk() {
        return new VkChannel.Incoming() {
            @Override
            public void save(List<VkChannel.Message> batch) throws IOException, SQLException {
                try (var store = new TelegramStore(database)) {
                    store.saveVkBatch(batch, Instant.now());
                }
            }

            @Override
            public void drain() throws IOException, SQLException, InterruptedException {
                if (live == null) {
                    return;
                }
                try (var store = new TelegramStore(database)) {
                    for (var item = store.nextVk(); item != null; item = store.nextVk()) {
                        if (item.unsupported()) {
                            var source = "vk:unsupported";
                            if (store.claim(source, item.event(), Instant.now())) {
                                try {
                                    vk.channel().send(item.peer(), TelegramTextHandoff.TEXT_ONLY, "vk-attachment:" + item.event());
                                    store.completeEvent(source, item.event(), Instant.now());
                                } catch (IOException failure) {
                                    store.release(source, item.event());
                                    throw failure;
                                }
                            }
                        } else {
                            receiveVk(item.event(), item.peer(), item.message(), item.name(), item.text());
                        }
                        store.deleteVk(item.event());
                    }
                }
            }
        };
    }

    public synchronized Status status() {
        var running = poller != null && poller.isAlive() && deliveries.isAlive();
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
        live = settings;
        poller = Thread.ofVirtual().name("telegram-handoff")
                .start(() -> poll(database, origin, settings.token(), settings.group(), settings.timeout()));
        deliveries = Thread.ofVirtual().name("telegram-deliveries").start(() -> deliver(settings.token()));
    }

    public ChannelActivity.Snapshot vkPolling() {
        return vk.pollActivity();
    }

    public ChannelActivity.Snapshot telegramPolling() {
        return activity.snapshot();
    }

    public LocalServiceControl serviceControl() {
        return serviceControl;
    }

    public Status vkStatus() {
        return vk.status();
    }

    synchronized void connectVk(String token, String community) throws IOException, InterruptedException {
        if (!status().connected()) {
            throw new IllegalStateException("Сначала подключите Telegram.");
        }
        vk.connect(token, community, incomingVk());
    }

    private void receiveVk(String event, long peer, long message, String name, String text)
            throws IOException, SQLException, InterruptedException {
        var telegram = live;
        try (var store = new TelegramStore(database); var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            var api = new TelegramBotApi(transport, origin, telegram.token(), API_TIMEOUT);
            var menu = new VkClientMenu(information, vk.channel(), serviceControl::intakePaused);
            if (!menu.handle(store, event, peer, text)) {
                new TelegramTextHandoff(telegram.group(), store, api, Clock.systemUTC(), information, queue, serviceControl::intakePaused)
                        .processVk(event, peer, message, name, text);
            }
        }
    }

    Map<String, ?> deliveryStatus() throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return Map.of("summary", store.summary(), "failures", store.failures());
        }
    }

    public boolean retry(String id) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.retry(id, Instant.now());
        }
    }

    Map<String, String> backup() throws IOException, SQLException {
        var createdAt = Instant.now();
        var name = "messenger-handoff-" + createdAt.toString().replace(':', '-') + "-" + UUID.randomUUID() + ".sqlite";
        var folder = database.toAbsolutePath().resolveSibling("backups");
        try (var store = new TelegramStore(database)) {
            store.backup(folder.resolve(name));
        }
        return Map.of("fileName", name, "createdAt", createdAt.toString());
    }

    public DeliveryState deliveryState(Instant now) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            var summary = store.summary();
            var oldest = summary.oldestPending() == null ? null : Instant.parse(summary.oldestPending());
            var age = oldest == null ? null : Math.max(0, Duration.between(oldest, now).toSeconds());
            var cycle = lastDeliveryCycle;
            boolean running = deliveries != null && deliveries.isAlive();
            boolean stalled = summary.pending() > 0 && (!running || cycle == null
                    || Duration.between(cycle, now).compareTo(Duration.ofMinutes(5)) > 0);
            var worker = new DeliveryProcess(cycle == null ? null : cycle.toString(), running,
                    stalled ? "stalled" : running ? "running" : "inactive");
            var state = stalled ? "stalled" : age != null && age > 300 ? "backlog"
                    : summary.failed() > 0 ? "failed" : "healthy";
            return new DeliveryState(summary.pending(), summary.failed(), summary.uncertain(), oldest == null ? null : oldest.toString(),
                    age, state, worker, store.incidents());
        }
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DeliveryState(long pending, long failed, long uncertain, String oldestPendingAt, Long oldestPendingAgeSeconds,
            String state, DeliveryProcess worker, java.util.List<DeliveryIncident> incidents) { }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DeliveryIncident(String id, String channel, int attempts, String createdAt, String reason,
            boolean retryAllowed, String requestId, String operatorTopicId, String operatorMessageId) { }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DeliveryProcess(String lastCycleAt, boolean running, String state) { }

    public Map<String, Long> deliveryCounts() throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            var summary = store.summary();
            return Map.of("pending", summary.pending(), "sent", summary.sent(), "failed", summary.failed());
        }
    }

    private void deliver(String token) {
        try (var store = new TelegramStore(database); var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            var api = new TelegramBotApi(transport, origin, token, API_TIMEOUT);
            var worker = new TelegramDeliveryWorker(store, api, Clock.systemUTC(), vk::channel);
            while (!Thread.currentThread().isInterrupted()) {
                lastDeliveryCycle = Instant.now();
                var processed = worker.runOnce();
                Thread.sleep(Duration.ofMillis(processed > 0 ? 100 : 1000));
            }
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IOException | SQLException failure) {
            LoggerFactory.getLogger(TelegramRuntime.class).warn("Telegram delivery worker stopped");
        }
    }

    static void verifyConnection(URI origin, String token, long group) throws IOException, InterruptedException {
        try (var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            new TelegramBotApi(transport, origin, token, API_TIMEOUT).verifySetup(group);
        }
    }

    @PreDestroy
    synchronized void stop() throws InterruptedException {
        vk.stop();
        if (deliveries != null) {
            deliveries.interrupt();
        }
        if (poller != null) {
            poller.interrupt();
            poller.join(Duration.ofSeconds(2));
        }
        if (deliveries != null) {
            deliveries.join(Duration.ofSeconds(2));
        }
    }

    private void poll(Path database, URI origin, String token, long group, int timeout) {
        try (var store = new TelegramStore(database); var transport = TelegramHttpTransport.open("", API_TIMEOUT)) {
            var api = new TelegramBotApi(transport, origin, token, API_TIMEOUT);
            var handoff = new TelegramTextHandoff(group, store, api, Clock.systemUTC(), information, queue, serviceControl::intakePaused);
            new TelegramPoller(api, handoff, timeout, activity).run();
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IOException | SQLException failure) {
            LoggerFactory.getLogger(TelegramRuntime.class).warn("Telegram storage could not start or continue");
        }
    }

    public record Status(boolean connected, boolean locked, String source) { }

    private record Settings(String token, long group, int timeout) { }
}
