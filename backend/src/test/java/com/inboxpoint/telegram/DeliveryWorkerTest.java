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
