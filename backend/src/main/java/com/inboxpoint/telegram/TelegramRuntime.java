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
    private final String proxy;
    private Thread poller;
    private Thread retention;
    private final int retentionDays;
    private final HandoffRuntime handoff;
    private final VkSetup vk;
    private final ChannelActivity activity = new ChannelActivity();
    private String source = NONE;

    TelegramRuntime(Environment environment, ClientInformation information) {
        this.information = information;
        this.environment = environment;
        com.inboxpoint.operations.InstanceId.validate(environment.getProperty("INSTANCE_ID", "default"));
        proxy = environment.getProperty("TELEGRAM_PROXY_URL", "").strip();
        if (!proxy.isEmpty()) {
            try (var validated = TelegramHttpTransport.open(proxy, API_TIMEOUT)) {
                // Opening the client validates the configured endpoint before a worker starts.
            }
        }
        retentionDays = environment.getProperty("CLOSED_REQUEST_RETENTION_DAYS", Integer.class, 7);
        if (retentionDays < 1 || retentionDays > 365) {
            throw new IllegalArgumentException("Invalid closed request retention days");
        }
        database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
        serviceControl = new LocalServiceControl(database);
        settingsFile = database.toAbsolutePath().resolveSibling("telegram-settings.json");
        origin = URI.create(environment.getProperty("inboxpoint.telegram.api-origin", "https://api.telegram.org"));
        vk = new VkSetup(environment, database);
        handoff = new HandoffRuntime(database, serviceControl::deliveryPaused, vk::channel);
    }

    @EventListener(ApplicationReadyEvent.class)
    synchronized void start() throws IOException, SQLException, InterruptedException {
        try (var store = new TelegramStore(database)) {
            store.recoverInterrupted();
            runRetention(store);
        }
        if (retention == null || !retention.isAlive()) {
            retention = Thread.ofVirtual().name("request-retention").start(this::retainInBackground);
        }
        handoff.start();
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
            if (!stored.isObject() || stored.size() != 3 || !stored.has("botToken") || !stored.has("operatorChatId") || !stored.has("pollTimeoutSeconds")) {
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

    private void runRetention(TelegramStore store) throws SQLException {
        var result = store.purge(Instant.now().minus(Duration.ofDays(retentionDays)));
        if (result.skippedRequests() > 0) {
            LoggerFactory.getLogger(TelegramRuntime.class).warn("Retention kept {} requests with unfinished deliveries",
                    result.skippedRequests());
        }
    }

    private void retainInBackground() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                Thread.sleep(Duration.ofHours(6));
                try (var store = new TelegramStore(database)) {
                    runRetention(store);
                }
            } catch (InterruptedException stopping) {
                Thread.currentThread().interrupt();
            } catch (IOException | SQLException failure) {
                LoggerFactory.getLogger(TelegramRuntime.class).warn("Scheduled retention cleanup failed");
            }
        }
    }

    private VkChannel.Incoming incomingVk() {
        return new VkChannel.Incoming() {
            @Override
            public void save(List<VkChannel.Inbound> batch) throws IOException, SQLException {
                try (var store = new TelegramStore(database)) {
                    store.saveVkBatch(batch, Instant.now());
                }
            }

            @Override
            public boolean drain() throws IOException, SQLException, InterruptedException {
                try (var store = new TelegramStore(database)) {
                    for (var queued = store.nextVk(); queued != null; queued = store.nextVk()) {
                        if (queued.nextAttemptAt() != null && queued.nextAttemptAt().isAfter(Instant.now())) {
                            return false;
                        }
                        var event = queued.event().event();
                        try {
                            var item = vk.channel().readQueued(queued.event());
                            if (item != null) {
                                processVkInbound(store, item);
                            }
                            store.deleteVk(event);
                        } catch (IOException | tools.jackson.core.JacksonException failed) {
                            store.failVk(event, Instant.now().plusSeconds(1));
                        }
                    }
                }
                return true;
            }
        };
    }

    private void processVkInbound(TelegramStore store, VkChannel.Message item)
            throws IOException, SQLException, InterruptedException {
        if (!item.unsupported()) {
            receiveVk(handoff.routingInbox(), store, item.event(), item.peer(), item.message(), item.name(), item.text());
            return;
        }
        var source = "vk:unsupported";
        if (store.claim(source, item.event(), Instant.now())) {
            try {
                vk.channel().send(item.peer(), TelegramTextHandoff.TEXT_ONLY, "vk-attachment:" + item.event());
                store.completeEvent(source, item.event(), Instant.now());
            } catch (IOException failed) {
                store.release(source, item.event());
                throw failed;
            }
        }
    }

    public synchronized Status status() {
        var running = poller != null && poller.isAlive();
        return new Status(running, running || ENVIRONMENT.equals(source), source);
    }

    synchronized List<TelegramTextHandoff.OperatorChat> discover(String token)
            throws IOException, InterruptedException {
        assertMutable();
        validateToken(token);
        try (var transport = TelegramHttpTransport.open(proxy, API_TIMEOUT)) {
            return new TelegramBotApi(transport, origin, token, API_TIMEOUT).discoverChats();
        }
    }

    synchronized void connect(String token, long group) throws IOException, SQLException, InterruptedException {
        assertMutable();
        startWorker(new Settings(token, group, 30), true);
        source = LOCAL;
    }

    synchronized void disconnectTelegram() throws IOException, InterruptedException {
        if (ENVIRONMENT.equals(source)) {
            throw new IllegalStateException("Управляется на сервере.");
        }
        if (!NONE.equals(vk.status().source())) {
            throw new IllegalStateException("Сначала отключите VK.");
        }
        if (NONE.equals(source)) {
            return;
        }
        stopTelegramPoller();
        Files.deleteIfExists(settingsFile);
        source = NONE;
    }

    synchronized void disconnectVk() throws IOException, InterruptedException {
        vk.disconnect();
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
        verifyConnection(origin, settings.token(), settings.group(), proxy);
        try (var store = new TelegramStore(database)) {
            if (save) {
                LocalJsonFile.write(settingsFile, JsonMapper.shared().createObjectNode()
                        .put("botToken", settings.token()).put("operatorChatId", settings.group())
                        .put("pollTimeoutSeconds", settings.timeout()));
            }
        }
        poller = Thread.ofVirtual().name("telegram-handoff")
                .start(() -> poll(database, origin, settings.token(), settings.group(), settings.timeout()));
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

    private void receiveVk(OperatorInbox inbox, TelegramStore store, String event, long peer, long message,
            String name, String text) throws IOException, SQLException, InterruptedException {
        var menu = new VkClientMenu(information, vk.channel(), serviceControl::intakePaused);
        if (!menu.handle(store, event, peer, text)) {
            new HandoffService(store, inbox, Clock.systemUTC(), queue).processVk(event, peer, message, name, text);
        }
    }

    public boolean retry(String id) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.retry(id, Instant.now());
        }
    }

    public boolean resolve(String id, boolean received) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.resolve(id, received, Instant.now());
        }
    }

    public InboundStatus inboundStatus() throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.inboundStatus();
        }
    }

    public boolean resolveInbound(String id, boolean retry) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.resolveInbound(id, retry);
        }
    }

    public record InboundStatus(String state, long quarantined, List<InboundIncident> incidents) { }

    public record InboundIncident(String eventId, String channel, String source, int attempts, String receivedAt, String reason) { }

    public OperatorRelayStatus operatorRelayStatus() throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.operatorActions().status();
        }
    }

    public boolean resolveOperatorAction(String id, boolean received) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.resolveOperatorAction(id, received, Instant.now());
        }
    }

    public record OperatorRelayStatus(String state, long uncertain, List<OperatorRelayIncident> incidents) { }

    public record OperatorRelayIncident(String id, String action, String channel, String clientMessageId, boolean confirmable,
            String createdAt, boolean initial, String operatorTopicId, String reason, String requestId, int sequence) { }

    public Map<String, Long> usageCounts(Instant since) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.usageCounts(since);
        }
    }

    public List<InboxRequest> inboxRequests() throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            return store.activeOperatorRequests();
        }
    }

    public List<InboxMessage> inboxMessages(String id) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            var request = store.byId(id);
            return request == null || !EmergencyOperatorInbox.isWebTopic(request.topic()) ? null : store.operatorMessages(id);
        }
    }

    public String inboxAction(String id, String key, String text, boolean close)
            throws IOException, SQLException, InterruptedException {
        try (var store = new TelegramStore(database)) {
            var request = store.byId(id);
            if (request == null || !EmergencyOperatorInbox.isWebTopic(request.topic())) {
                return "missing";
            }
            if (!request.active()) {
                return close ? "ok" : "closed";
            }
            var event = "web:" + (close ? "close:" : "reply:") + id + ":" + key;
            var service = new HandoffService(store, handoff.routingInbox(), Clock.systemUTC(), queue);
            service.relayReply(request, event, close ? "/close" : text, event);
            return "ok";
        }
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record InboxRequest(String id, String channel, String createdAt, String displayName, String latestMessageAt,
            String status) { }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record InboxMessage(String id, String direction, String text, String senderName, String createdAt,
            String deliveryStatus, Boolean deliveryOutcomeUnknown) { }

    public DeliveryState deliveryState(Instant now) throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            var summary = store.summary();
            var oldest = summary.oldestPending() == null ? null : Instant.parse(summary.oldestPending());
            var age = oldest == null ? null : Math.max(0, Duration.between(oldest, now).toSeconds());
            var cycle = handoff.lastCycle();
            boolean running = handoff.running();
            boolean stalled = workerStalled(running, handoff.lastActivity(), now);
            var worker = new DeliveryProcess(cycle == null ? null : cycle.toString(), running,
                    stalled ? "stalled" : running ? "running" : "inactive");
            var state = serviceControl.deliveryPaused() ? "paused" : stalled ? "stalled" : age != null && age > 300 ? "backlog"
                    : summary.failed() > 0 ? "failed" : "healthy";
            return new DeliveryState(summary.pending(), summary.failed(), summary.uncertain(), oldest == null ? null : oldest.toString(),
                    age, state, worker, store.incidents());
        }
    }

    static boolean workerStalled(boolean running, Instant lastActivity, Instant now) {
        return !running || lastActivity != null && Duration.between(lastActivity, now).compareTo(Duration.ofMinutes(5)) > 0;
    }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DeliveryState(long pending, long failed, long uncertain, String oldestPendingAt, Long oldestPendingAgeSeconds,
            String state, DeliveryProcess worker, java.util.List<DeliveryIncident> incidents) { }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DeliveryIncident(String id, String channel, int attempts, String createdAt, String reason,
            boolean retryAllowed, boolean outcomeUnknown, String requestId, String operatorTopicId, String operatorMessageId) { }

    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DeliveryProcess(String lastCycleAt, boolean running, String state) { }

    public Map<String, Long> deliveryCounts() throws IOException, SQLException {
        try (var store = new TelegramStore(database)) {
            var summary = store.summary();
            return Map.of("pending", summary.pending(), "sent", summary.sent(), "failed", summary.failed());
        }
    }

    static void verifyConnection(URI origin, String token, long group) throws IOException, InterruptedException {
        verifyConnection(origin, token, group, "");
    }

    private static void verifyConnection(URI origin, String token, long group, String proxy) throws IOException, InterruptedException {
        try (var transport = TelegramHttpTransport.open(proxy, API_TIMEOUT)) {
            new TelegramBotApi(transport, origin, token, API_TIMEOUT).verifySetup(group);
        }
    }

    @PreDestroy
    synchronized void stop() throws InterruptedException {
        if (retention != null) {
            retention.interrupt();
            retention.join(Duration.ofSeconds(2));
        }
        handoff.stop();
        vk.stop();
        stopTelegramPoller();
    }

    private void stopTelegramPoller() throws InterruptedException {
        if (poller != null) {
            poller.interrupt();
            if (!poller.join(Duration.ofSeconds(2))) {
                throw new IllegalStateException("Не удалось остановить Telegram.");
            }
            poller = null;
        }
    }

    private void poll(Path database, URI origin, String token, long group, int timeout) {
        try (var store = new TelegramStore(database); var transport = TelegramHttpTransport.open(proxy, API_TIMEOUT)) {
            var api = new TelegramBotApi(transport, origin, token, API_TIMEOUT);
            var unregisterClient = handoff.registerTelegram(api);
            var unregisterInbox = handoff.registerOperatorInbox(new DurableTelegramInbox(new TelegramTopicsInbox(api, group), database, Clock.systemUTC()));
            try {
                var handler = new TelegramTextHandoff(group, store, api, Clock.systemUTC(), information, queue, serviceControl::intakePaused, handoff.routingInbox());
                new TelegramPoller(api, handler, timeout, activity).run();
            } finally {
                unregisterInbox.run();
                unregisterClient.run();
            }
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IOException | SQLException failure) {
            LoggerFactory.getLogger(TelegramRuntime.class).warn("Telegram storage could not start or continue");
        }
    }

    public record Status(boolean connected, boolean locked, String source) { }

    private record Settings(String token, long group, int timeout) { }
}
