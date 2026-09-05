package com.inboxpoint.operations;

import java.io.IOException;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AvailabilityMonitorTest {
    @Test
    void announcesOneOutageAndOneRecovery() throws Exception {
        var available = new AtomicBoolean(false);
        var alerts = new ArrayList<String>();
        var monitor = new AvailabilityMonitor(() -> {
            if (!available.get()) {
                throw new IOException("Synthetic outage");
            }
        }, alerts::add);
        monitor.checkOnce();
        monitor.checkOnce();
        available.set(true);
        monitor.checkOnce();
        monitor.checkOnce();
        assertThat(alerts).hasSize(2);
        assertThat(alerts.get(0)).contains("недоступен");
        assertThat(alerts.get(1)).contains("снова доступен");
    }
}
