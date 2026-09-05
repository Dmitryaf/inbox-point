package com.inboxpoint.operations;

import java.io.IOException;
import java.time.Duration;

import org.slf4j.LoggerFactory;

final class AvailabilityMonitor {
    private final Check probe;
    private final Alert alert;
    private boolean outage;
    private boolean notified;

    AvailabilityMonitor(Check probe, Alert alert) {
        this.probe = probe;
        this.alert = alert;
    }

    void run(Duration interval) throws InterruptedException {
        while (!Thread.currentThread().isInterrupted()) {
            checkOnce();
            Thread.sleep(interval);
        }
    }

    void checkOnce() throws InterruptedException {
        try {
            probe.check();
        } catch (IOException unavailable) {
            outage = true;
            if (!notified) {
                notified = send("Messenger Handoff недоступен. Проверьте сервер и контейнер приложения.");
            }
            return;
        }
        if (outage && notified) {
            send("Messenger Handoff снова доступен.");
        }
        outage = false;
        notified = false;
    }

    private boolean send(String text) throws InterruptedException {
        try {
            alert.send(text);
            return true;
        } catch (IOException failed) {
            LoggerFactory.getLogger(AvailabilityMonitor.class).warn("Availability alert could not be delivered");
            return false;
        }
    }

    @FunctionalInterface
    interface Check {
        void check() throws IOException, InterruptedException;
    }

    @FunctionalInterface
    interface Alert {
        void send(String message) throws IOException, InterruptedException;
    }
}
