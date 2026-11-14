package com.inboxpoint.operations;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.LinkedBlockingQueue;

import com.inboxpoint.persistence.SqliteTextHandoff;
import com.inboxpoint.telegram.TelegramHttpTransport;
import com.inboxpoint.telegram.TelegramTextHandoff;
import com.inboxpoint.vk.VkTextHandoff;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
final class ChannelRuntime {
    private static final Logger LOG = LoggerFactory.getLogger(ChannelRuntime.class);
    private static final Duration API_TIMEOUT = Duration.ofSeconds(8);
    private static final Duration WORKER_STALE_AFTER = Duration.ofMinutes(5);

    private final Environment environment;
    private final Path database;
    private final LocalServiceControl control;
    private final int retentionDays;
    private final ChannelApiEndpoints endpoints;
    private final Clock clock = Clock.systemUTC();
    private final Instant startedAt = clock.instant();
    private final PollActivity telegramActivity = new PollActivity();
    private final PollActivity vkActivity = new PollActivity();
    private final LinkedBlockingQueue<FutureTask<?>> setupCommands = new LinkedBlockingQueue<>();
    private Thread worker;
    private volatile boolean stopping;
    private boolean acceptingSetup;
    private LiveChannels liveChannels;
    private volatile Instant lastWorkerCycle;
    private volatile boolean queuesReady;

    ChannelRuntime(Environment environment, ObjectProvider<ChannelApiEndpoints> endpoints) {
        this.environment = environment;
        this.database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
        this.control = new LocalServiceControl(database);
        this.retentionDays = environment.getProperty("CLOSED_REQUEST_RETENTION_DAYS", Integer.class, 7);
        if (retentionDays < 1 || retentionDays > 365) {
            throw new IllegalArgumentException("CLOSED_REQUEST_RETENTION_DAYS must be between 1 and 365");
        }
        this.endpoints = endpoints.getIfAvailable(ChannelApiEndpoints::production);
    }

    @EventListener(ApplicationReadyEvent.class)
    void start() {
        synchronized (setupCommands) {
            acceptingSetup = true;
            worker = Thread.ofVirtual().name("inbox-worker").start(this::run);
        }
    }

    @PreDestroy
    void stop() {
        stopping = true;
        stopThread(worker);
    }

    SetupStatus status(String channel) {
        var state = "telegram".equals(channel) ? telegramActivity : vkActivity;
        return new SetupStatus(state.connected, state.connected || "environment".equals(state.source),
                state.expected, state.source);
    }

    LocalServiceControl control() {
        return control;
    }

    boolean retryHeldOperatorReply(String actionId) throws Exception {
        return onWorker(live -> live.telegram != null && live.telegram.retryHeldOperatorReply(actionId));
    }

    RuntimeStatus monitoringStatus() {
        var now = clock.instant();
        return new RuntimeStatus(startedAt, now, lastWorkerCycle, worker != null && worker.isAlive(),
                telegramActivity.snapshot(now), vkActivity.snapshot(now));
    }

    List<TelegramTextHandoff.OperatorChat> discoverTelegram(String token) throws Exception {
        return onWorker(live -> {
            assertMutable(telegramActivity, "Telegram");
            try (var http = openTelegramHttp()) {
                return TelegramTextHandoff.discoverChats(http, endpoints.telegram(), token, API_TIMEOUT);
            }
        });
    }

    void connectTelegram(String token, long chat) throws Exception {
        onWorker(live -> {
            assertMutable(telegramActivity, "Telegram");
            live.connectTelegram(new ChannelSettings.Config(token, chat, 30), true);
            return null;
        });
    }

    void connectVk(String token, String community) throws Exception {
        onWorker(live -> {
            if (!telegramActivity.connected) {
                throw new SetupFailure(409, "Сначала подключите Telegram.");
            }
            assertMutable(vkActivity, "VK");
            var group = VkTextHandoff.resolveCommunity(live.vkHttp, endpoints.vk(), token, community, API_TIMEOUT);
            live.connectVk(new ChannelSettings.Config(token, group, 25), true);
            return null;
        });
    }

    void disconnect(String channel) throws Exception {
        onWorker(live -> {
            boolean telegram = "telegram".equals(channel);
            var state = telegram ? telegramActivity : vkActivity;
            if ("environment".equals(state.source)) {
                throw new SetupFailure(409, "Управляется на сервере.");
            }
            if (telegram && (!"none".equals(vkActivity.source) || vkActivity.expected)) {
                throw new SetupFailure(409, "Сначала отключите VK.");
            }
            if (telegram) {
                live.stopTelegram();
            } else {
                live.stopVk();
            }
            ChannelSettings.clear(database, channel);
            state.source = "none";
            control.setExpected(channel, false);
            state.expected = false;
            return null;
        });
    }

    private static void assertMutable(PollActivity state, String name) throws SetupFailure {
        if ("environment".equals(state.source)) {
            throw new SetupFailure(400, "Эта настройка управляется сервером.");
        }
        if (state.connected) {
            throw new SetupFailure(400, name + " уже подключён.");
        }
    }

    private <T> T onWorker(SetupWork<T> operation) throws Exception {
        FutureTask<T> task;
        synchronized (setupCommands) {
            if (stopping || !acceptingSetup) {
                throw new SetupFailure(503, "Подключение каналов пока недоступно.");
            }
            task = new FutureTask<>(() -> operation.run(liveChannels));
            setupCommands.add(task);
        }
        try {
            return task.get();
        } catch (CancellationException cancelled) {
            throw new SetupFailure(503, "Подключение каналов пока недоступно.");
        } catch (ExecutionException failed) {
            if (failed.getCause() instanceof Exception failure) {
                throw failure;
            }
            throw new IllegalStateException("Channel setup failed");
        }
    }

    boolean ready() {
        var now = clock.instant();
        var last = lastWorkerCycle;
        return last != null && !now.isAfter(last.plus(WORKER_STALE_AFTER)) && queuesReady
                && telegramActivity.ready(now) && vkActivity.ready(now);
    }

    private void run() {
        try (var store = SqliteTextHandoff.open(database, clock.instant()); var channels = new LiveChannels(store)) {
            runRetention(store, clock.instant());
            var telegramSettings = ChannelSettings.read(database, environment, "telegram");
            var vkSettings = ChannelSettings.read(database, environment, "vk");
            var expected = control.rememberConfiguredChannels(telegramSettings.configured(), vkSettings.configured());
            telegramActivity.expected = expected.telegram();
            vkActivity.expected = expected.vk();
            telegramActivity.source = source("TELEGRAM_ENABLED", telegramSettings);
            vkActivity.source = source("VK_ENABLED", vkSettings);
            if (telegramSettings.config() != null) {
                startChannel(telegramActivity, () -> channels.connectTelegram(telegramSettings.config(), false));
            }
            if (vkSettings.config() != null) {
                startChannel(vkActivity, () -> channels.connectVk(vkSettings.config(), false));
            }
            liveChannels = channels;
            work(channels);
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IOException | SQLException | RuntimeException failure) {
            LOG.warn("Inbox worker could not initialize or continue");
        } finally {
            lastWorkerCycle = null;
            synchronized (setupCommands) {
                acceptingSetup = false;
                liveChannels = null;
                for (var command = setupCommands.poll(); command != null; command = setupCommands.poll()) {
                    command.cancel(false);
                }
            }
        }
    }

    private String source(String enabled, ChannelSettings.Selection selection) {
        return "true".equals(environment.getProperty(enabled)) ? "environment"
                : selection.config() == null ? "none" : "local";
    }

    private void startChannel(PollActivity activity, Work start) throws InterruptedException {
        try {
            start.run();
        } catch (IOException | SQLException failure) {
            activity.failure(clock.instant(), "startup", failure);
            LOG.warn("Channel startup did not complete");
        }
    }

    private TelegramHttpTransport openTelegramHttp() throws IOException {
        try {
            return TelegramHttpTransport.open(environment.getProperty("TELEGRAM_PROXY_URL", ""), API_TIMEOUT);
        } catch (IllegalArgumentException invalid) {
            throw new IOException("Telegram proxy configuration cannot be used");
        }
    }

    private Thread startPoller(String channel, PollActivity activity, Poll poll) {
        activity.lastSuccessfulPoll = null;
        activity.lastFailedPoll = null;
        activity.lastRecoveredAt = null;
        activity.lastFailure = null;
        activity.consecutiveFailures = 0;
        activity.failed = false;
        activity.startedAt = clock.instant();
        return Thread.ofVirtual().name("inbox-" + channel + "-poll").start(() -> {
            try (var inbox = SqliteTextHandoff.openExisting(database)) {
                while (!Thread.currentThread().isInterrupted()) {
                    PollResult result;
                    Exception error = null;
                    try {
                        result = poll.run(inbox);
                    } catch (IOException | SQLException failure) {
                        result = PollResult.FAILURE;
                        error = failure;
                    }
                    switch (result) {
                        case SUCCESS -> {
                            activity.lastSuccessfulPoll = clock.instant();
                            if (activity.failed) {
                                activity.lastRecoveredAt = activity.lastSuccessfulPoll;
                            }
                            activity.consecutiveFailures = 0;
                            activity.failed = false;
                            Thread.sleep(25);
                        }
                        case DRAINING -> Thread.sleep(100);
                        case FAILURE -> {
                            if (!activity.failed) {
                                LOG.warn("{} polling interrupted by a channel or queue error", channel);
                            }
                            activity.failure(clock.instant(), "poll", error);
                            Thread.sleep(1000);
                        }
                    }
                }
            } catch (InterruptedException stopping) {
                Thread.currentThread().interrupt();
            } catch (SQLException | RuntimeException failure) {
                LOG.warn("{} poller could not initialize or continue", channel);
            } finally {
                activity.startedAt = null;
            }
        });
    }

    private void work(LiveChannels live) throws InterruptedException {
        var nextRecovery = Instant.EPOCH;
        var nextRetention = clock.instant().plus(Duration.ofHours(6));
        while (!stopping && !Thread.currentThread().isInterrupted()) {
            var command = setupCommands.poll();
            if (command != null) {
                command.run();
            }
            var telegram = live.telegram;
            var vk = live.vk;
            var telegramOk = telegram == null || runCycle("Telegram", () -> {
                telegram.processNext();
                telegram.sendPending();
            });
            var vkOk = vk == null || runCycle("VK", () -> {
                vk.processNext();
                vk.sendPending();
            });
            if (telegram != null) {
                runCycle("delivery notifications", telegram::notifyFailedDeliveries);
            }
            var now = clock.instant();
            if (!now.isBefore(nextRetention)) {
                runRetention(live.store, now);
                nextRetention = now.plus(Duration.ofHours(6));
            }
            if (telegram != null && telegramActivity.lastSuccessfulPoll != null && telegramActivity.ready(now)
                    && !now.isBefore(nextRecovery)) {
                nextRecovery = now.plusSeconds(10);
                runCycle("web inbox recovery", telegram::recoverWebRequests);
            }
            var queuesOk = runCycle("queue", () -> queuesReady = live.store.queuesReady(control.deliveryPaused(), now));
            if (!queuesOk || !telegramOk || !vkOk) {
                queuesReady = false;
            }
            lastWorkerCycle = now;
            Thread.sleep(telegramOk && vkOk && queuesOk ? 100 : 1000);
        }
    }

    private void runRetention(SqliteTextHandoff store, Instant now) {
        try {
            var result = store.purgeClosedConversationContent(now.minus(Duration.ofDays(retentionDays)));
            if (result.skippedRequests() > 0) {
                LOG.warn("Retention kept {} expired requests with unfinished work", result.skippedRequests());
            }
        } catch (SQLException failure) {
            LOG.warn("Retention cleanup could not complete");
        }
    }

    private static boolean runCycle(String name, Work work) throws InterruptedException {
        try {
            work.run();
            return true;
        } catch (IOException | SQLException failure) {
            LOG.warn("{} work could not complete", name);
            return false;
        }
    }

    private static void stopThread(Thread thread) {
        if (thread == null) {
            return;
        }
        thread.interrupt();
        boolean interrupted = Thread.interrupted();
        for (;;) {
            try {
                thread.join();
                break;
            } catch (InterruptedException stopping) {
                interrupted = true;
            }
        }
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    private static final class PollActivity {
        private volatile boolean connected;
        private volatile String source = "none";
        private volatile boolean expected;
        private volatile boolean failed;
        private volatile Instant startedAt;
        private volatile Instant lastSuccessfulPoll;
        private volatile Instant lastFailedPoll;
        private volatile Instant lastRecoveredAt;
        private volatile int consecutiveFailures;
        private volatile ChannelFailure lastFailure;

        private void failure(Instant time, String stage, Exception error) {
            lastFailedPoll = time;
            lastFailure = new ChannelFailure(stage, error instanceof ApiFailure failure ? failure.diagnostic() : null);
            consecutiveFailures++;
            failed = true;
        }

        private ChannelStatus snapshot(Instant now) {
            var source = this.source;
            var last = lastSuccessfulPoll;
            var start = startedAt;
            var running = connected && start != null;
            String state;
            if ("none".equals(source)) {
                state = expected ? "configuration_missing" : "not_configured";
            } else if (failed) {
                state = "poll_failed";
            } else if (!running) {
                state = "stopped";
            } else if (now.isAfter((last == null ? start : last).plusSeconds(120))) {
                state = "poll_stale";
            } else {
                state = last == null ? "starting" : "running";
            }
            return new ChannelStatus(!"none".equals(source), running, source, state,
                    last, lastFailedPoll, lastRecoveredAt, consecutiveFailures, lastFailure);
        }

        private boolean ready(Instant now) {
            if (!expected) {
                return true;
            }
            var started = startedAt;
            var last = lastSuccessfulPoll;
            return started != null && !failed && !now.isAfter((last == null ? started : last).plusSeconds(120));
        }
    }

    private final class LiveChannels implements AutoCloseable {
        private final SqliteTextHandoff store;
        private final HttpClient vkHttp = HttpClient.newBuilder().connectTimeout(API_TIMEOUT)
                .proxy(HttpClient.Builder.NO_PROXY).build();
        private TelegramHttpTransport telegramHttp;
        private TelegramTextHandoff telegram;
        private VkTextHandoff vk;
        private Thread telegramPoller;
        private Thread vkPoller;

        private LiveChannels(SqliteTextHandoff store) {
            this.store = store;
        }

        private void connectTelegram(ChannelSettings.Config config, boolean local)
                throws IOException, SQLException, InterruptedException {
            var http = openTelegramHttp();
            try {
                var connected = TelegramTextHandoff.connect(database, store, http, endpoints.telegram(), config.token(),
                        config.id(), API_TIMEOUT, clock);
                if (local) {
                    saveLocal("telegram", telegramActivity, config);
                }
                telegramHttp = http;
                telegram = connected;
                telegramPoller = startPoller("telegram", telegramActivity, inbox ->
                        connected.poll(inbox, config.pollSeconds()) ? PollResult.SUCCESS : PollResult.DRAINING);
                telegramActivity.connected = true;
                if (vk != null) {
                    vk.setOperator(connected);
                }
            } catch (IllegalArgumentException invalid) {
                http.close();
                throw new IOException("Invalid Telegram settings");
            } catch (IOException | SQLException | InterruptedException | RuntimeException failure) {
                http.close();
                throw failure;
            }
        }

        private void connectVk(ChannelSettings.Config config, boolean local)
                throws IOException, SQLException, InterruptedException {
            var connected = new VkTextHandoff(database, store, vkHttp, endpoints.vk(), config.token(), config.id(),
                    API_TIMEOUT, telegram, clock);
            if (local) {
                saveLocal("vk", vkActivity, config);
            }
            vk = connected;
            vkPoller = startPoller("vk", vkActivity, inbox -> switch (connected.poll(inbox, config.pollSeconds())) {
                case DRAINING -> PollResult.DRAINING;
                case HISTORY_EXPIRED -> PollResult.FAILURE;
                case POLLED, KEY_REFRESHED -> PollResult.SUCCESS;
                default -> throw new IllegalStateException("Unexpected VK polling result");
            });
            vkActivity.connected = true;
        }

        private void saveLocal(String channel, PollActivity activity, ChannelSettings.Config config) throws IOException {
            control.setExpected(channel, true);
            activity.expected = true;
            ChannelSettings.save(database, channel, config);
            activity.source = "local";
        }

        private void stopTelegram() {
            stopThread(telegramPoller);
            telegramPoller = null;
            telegramActivity.connected = false;
            telegram = null;
            if (telegramHttp != null) {
                telegramHttp.close();
                telegramHttp = null;
            }
            if (vk != null) {
                vk.setOperator(null);
            }
        }

        private void stopVk() {
            stopThread(vkPoller);
            vkPoller = null;
            vkActivity.connected = false;
            vk = null;
        }

        @Override
        public void close() {
            if (telegramPoller != null) {
                telegramPoller.interrupt();
            }
            stopVk();
            stopTelegram();
            vkHttp.close();
        }
    }

    record SetupStatus(boolean connected, boolean locked, boolean expected, String source) { }

    record RuntimeStatus(Instant startedAt, Instant observedAt, Instant lastWorkerCycle, boolean workerRunning,
            ChannelStatus telegram, ChannelStatus vk) { }

    record ChannelStatus(boolean configured, boolean running, String source, String state, Instant lastSuccessfulPollAt,
            Instant lastFailedPollAt, Instant lastRecoveredAt, int consecutiveFailures, ChannelFailure lastFailure) { }

    record ChannelFailure(String stage, ApiFailure.Diagnostic request) { }

    static final class SetupFailure extends IOException {
        final int status;

        SetupFailure(int status, String message) {
            super(message);
            this.status = status;
        }
    }

    @FunctionalInterface
    private interface SetupWork<T> {
        T run(LiveChannels live) throws Exception;
    }

    private enum PollResult { SUCCESS, DRAINING, FAILURE }

    @FunctionalInterface
    private interface Poll {
        PollResult run(SqliteTextHandoff inbox) throws IOException, SQLException, InterruptedException;
    }

    @FunctionalInterface
    private interface Work {
        void run() throws IOException, SQLException, InterruptedException;
    }
}
