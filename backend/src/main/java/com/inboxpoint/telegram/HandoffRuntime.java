package com.inboxpoint.telegram;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;

import com.inboxpoint.vk.VkChannel;
import org.slf4j.LoggerFactory;

final class HandoffRuntime {
    private final Path database;
    private final BooleanSupplier paused;
    private final Supplier<VkChannel> vk;
    private final Supplier<tools.jackson.databind.JsonNode> keyboard;
    private final AtomicReference<OperatorInbox> inbox = new AtomicReference<>();
    private final OperatorInbox routingInbox = new SwitchableOperatorInbox(inbox::get);
    private final AtomicReference<TelegramBotApi> telegram = new AtomicReference<>();
    private volatile Thread deliveries;
    private volatile Instant lastCycle;
    private volatile Instant startedAt;

    HandoffRuntime(Path database, BooleanSupplier paused, Supplier<VkChannel> vk) {
        this(database, paused, vk, () -> null);
    }

    HandoffRuntime(Path database, BooleanSupplier paused, Supplier<VkChannel> vk, Supplier<tools.jackson.databind.JsonNode> keyboard) {
        this.keyboard = keyboard;
        this.database = database;
        this.paused = paused;
        this.vk = vk;
    }

    OperatorInbox operatorInbox() {
        return inbox.get();
    }

    OperatorInbox routingInbox() {
        return routingInbox;
    }

    Runnable registerOperatorInbox(OperatorInbox target) {
        inbox.set(target);
        return () -> inbox.compareAndSet(target, null);
    }

    Runnable registerTelegram(TelegramBotApi target) {
        telegram.set(target);
        return () -> telegram.compareAndSet(target, null);
    }

    synchronized void start() {
        if (!running()) {
            lastCycle = null;
            startedAt = Instant.now();
            deliveries = Thread.ofVirtual().name("handoff-deliveries").start(this::deliver);
        }
    }

    boolean running() {
        var thread = deliveries;
        return thread != null && thread.isAlive();
    }

    Instant lastCycle() {
        return lastCycle;
    }

    Instant lastActivity() {
        return lastCycle == null ? startedAt : lastCycle;
    }

    private void deliver() {
        try (var store = new TelegramStore(database)) {
            var worker = new TelegramDeliveryWorker(store, telegram::get, Clock.systemUTC(), vk, paused, keyboard);
            while (!Thread.currentThread().isInterrupted()) {
                lastCycle = Instant.now();
                var processed = worker.runOnce();
                notifyFailures(store, routingInbox, Clock.systemUTC());
                Thread.sleep(Duration.ofMillis(processed > 0 ? 100 : 1000));
            }
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
        } catch (IOException | SQLException failure) {
            LoggerFactory.getLogger(HandoffRuntime.class).warn("Delivery worker stopped");
        }
    }

    static void notifyFailures(TelegramStore store, OperatorInbox target, Clock clock)
            throws SQLException, InterruptedException {
        if (target == null) {
            return;
        }
        for (var failure : store.unnotified(clock.instant())) {
            try {
                target.notifyFailure(failure);
            } catch (IOException unavailable) {
                store.notificationRetry(failure.id(), clock.instant().plusSeconds(30));
                continue;
            }
            store.notified(failure.id(), clock.instant());
        }
    }

    synchronized void stop() throws InterruptedException {
        if (deliveries != null) {
            deliveries.interrupt();
            deliveries.join(Duration.ofSeconds(2));
        }
    }
}
