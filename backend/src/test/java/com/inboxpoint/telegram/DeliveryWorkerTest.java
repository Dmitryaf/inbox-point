package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class DeliveryWorkerTest {
    @TempDir
    Path directory;

    @Test
    void recordsAConfirmedOutcomeOnceAndOnlyRequeuesIfTheClientDidNotReceiveIt() throws Exception {
        var time = Instant.parse("2026-09-01T08:00:00Z");
        try (var store = new TelegramStore(directory.resolve("resolution.sqlite"))) {
            var request = new TelegramStore.Request("question", 123, 42, true, "telegram");
            store.open(request, time);
            store.queue(request, "first", 702, "Answer one", time);
            store.failed("operator:first", true, "timeout");
            var first = store.incidents().getFirst();
            assertThat(first.outcomeUnknown()).isTrue();
            assertThat(store.resolve(first.id(), true, time)).isTrue();
            assertThat(store.resolve(first.id(), false, time)).isFalse();
            assertThat(store.summary().sent()).isEqualTo(1);
            assertThat(store.pending(time, false)).isEmpty();
            store.queue(request, "second", 703, "Answer two", time);
            store.failed("operator:second", true, "timeout");
            var second = store.incidents().getFirst();
            assertThat(store.resolve(second.id(), false, time)).isTrue();
            assertThat(store.resolve(second.id(), true, time)).isFalse();
            assertThat(store.pending(time, false)).hasSize(1);
            assertThat(store.summary().uncertain()).isZero();
        }
    }

    @Test
    void leavesPendingDeliveryUntouchedUntilThePersistedStopIsLifted() throws Exception {
        var database = directory.resolve("paused.sqlite");
        var time = Instant.parse("2026-09-01T08:00:00Z");
        var control = new com.inboxpoint.operations.LocalServiceControl(database);
        control.setDelivery(true, time);
        var reopened = new com.inboxpoint.operations.LocalServiceControl(database);
        assertThat(reopened.deliveryPaused()).isTrue();
        assertThat(reopened.intakePaused("telegram")).isFalse();
        try (var server = new TelegramTestServer(request -> TelegramTestServer.Response.message(501));
                var client = HttpClient.newHttpClient(); var store = new TelegramStore(database)) {
            var api = new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var request = new TelegramStore.Request("question", 123, 42, true, "telegram");
            store.open(request, time);
            store.queue(request, "reply", 702, "Answer", time);
            var worker = new TelegramDeliveryWorker(store, api, Clock.fixed(time, ZoneOffset.UTC), () -> null,
                    reopened::deliveryPaused);
            assertThat(worker.runOnce()).isZero();
            assertThat(server.requests()).isEmpty();
            assertThat(store.summary().pending()).isEqualTo(1);
            reopened.setDelivery(false, time.plusSeconds(1));
            assertThat(worker.runOnce()).isEqualTo(1);
            assertThat(store.summary().sent()).isEqualTo(1);
        }
    }

    @Test
    void quarantinesAnAttemptThatWasInFlightWhenTheProcessStopped() throws Exception {
        var database = directory.resolve("interrupted.sqlite");
        var time = Instant.parse("2026-09-01T08:00:00Z");
        try (var store = new TelegramStore(database)) {
            var request = new TelegramStore.Request("question", 123, 42, true, "telegram");
            store.open(request, time);
            store.queue(request, "reply", 704, "Answer", time);
            var item = store.pending(time, false).getFirst();
            assertThat(store.beginAttempt(item.key(), time)).isTrue();
            assertThat(store.beginAttempt(item.key(), time)).isFalse();
        }
        try (var store = new TelegramStore(database)) {
            store.recoverInterrupted();
            assertThat(store.pending(time, false)).isEmpty();
            assertThat(store.summary().uncertain()).isEqualTo(1);
            var failure = store.failures().getFirst();
            assertThat(failure.retryAllowed()).isFalse();
            var incident = store.incidents().getFirst();
            assertThat(incident.id()).isEqualTo(failure.id());
            assertThat(incident.requestId()).isNotBlank();
            assertThat(incident.operatorTopicId()).isNotBlank();
            assertThat(incident.operatorMessageId()).isNotBlank();
            assertThat(store.retry(failure.id(), time)).isFalse();
        }
    }

    @Test
    void doesNotRepeatAnUncertainTelegramSendAndRefusesManualRetry() throws Exception {
        var database = directory.resolve("uncertain.sqlite");
        var time = Instant.parse("2026-09-01T08:00:00Z");
        try (var server = new TelegramTestServer(request -> new TelegramTestServer.Response(500,
                "{\"ok\":false,\"error_code\":500}")); var client = HttpClient.newHttpClient();
                var store = new TelegramStore(database)) {
            var api = new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var request = new TelegramStore.Request("question", 123, 42, true, "telegram");
            store.open(request, time);
            store.queue(request, "reply", 702, "Answer", time);
            var worker = new TelegramDeliveryWorker(store, api, Clock.fixed(time, ZoneOffset.UTC));
            assertThat(worker.runOnce()).isEqualTo(1);
            assertThat(worker.runOnce()).isZero();
            assertThat(store.summary().uncertain()).isEqualTo(1);
            var blocked = store.failures().getFirst();
            assertThat(blocked.retryAllowed()).isFalse();
            assertThat(store.retry(blocked.id(), time)).isFalse();
            assertThat(server.requests()).hasSize(1);
        }
    }

    @Test
    void retriesAConfirmedRejectionAfterTheDelayAndRecordsOneSuccessAcrossRestart() throws Exception {
        var database = directory.resolve("queued.sqlite");
        var submitted = Instant.parse("2026-09-01T08:00:00Z");
        var sends = new AtomicInteger(0);
        try (var server = new TelegramTestServer(request -> {
            assertThat(request.method()).isEqualTo("sendMessage");
            assertThat(request.body().path("chat_id").asLong()).isEqualTo(123);
            if (sends.incrementAndGet() == 1) {
                return new TelegramTestServer.Response(429,
                        "{\"ok\":false,\"error_code\":429,\"description\":\"Too Many Requests\"}");
            }
            return TelegramTestServer.Response.message(501);
        }); var client = HttpClient.newHttpClient()) {
            var api = new TelegramBotApi(client, server.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            try (var store = new TelegramStore(database)) {
                var request = new TelegramStore.Request("question", 123, 42, true, "telegram");
                store.open(request, submitted);
                store.queue(request, "reply", 702, "Answer", submitted);
                var worker = new TelegramDeliveryWorker(store, api, Clock.fixed(submitted, ZoneOffset.UTC));
                assertThat(worker.runOnce()).isEqualTo(1);
                assertThat(worker.runOnce()).isZero();
                assertThat(store.summary().pending()).isEqualTo(1);
            }
            try (var restarted = new TelegramStore(database)) {
                var worker = new TelegramDeliveryWorker(restarted, api,
                        Clock.fixed(submitted.plusSeconds(6), ZoneOffset.UTC));
                assertThat(worker.runOnce()).isEqualTo(1);
                assertThat(worker.runOnce()).isZero();
                assertThat(restarted.summary().sent()).isEqualTo(1);
            }
            assertThat(sends).hasValue(2);
        }
    }
}
