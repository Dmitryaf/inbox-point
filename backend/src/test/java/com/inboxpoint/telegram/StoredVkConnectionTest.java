package com.inboxpoint.telegram;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import com.inboxpoint.content.ClientInformation;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class StoredVkConnectionTest {
    @TempDir
    Path directory;

    @Test
    void loadsSavedVkBeforeTelegramAndRetriesAStartupApiFailure() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var origin = "http://127.0.0.1:" + server.getAddress().getPort();
        var requests = new AtomicInteger();
        var polling = new CountDownLatch(1);
        server.createContext("/method/groups.getLongPollServer", exchange -> {
            try (exchange) {
                var recovered = requests.incrementAndGet() > 1;
                var body = recovered
                        ? "{\"response\":{\"key\":\"synthetic\",\"server\":\"" + origin + "/long-poll\",\"ts\":\"1\"}}"
                        : "{\"error\":{\"error_code\":29,\"error_msg\":\"Synthetic failure\"}}";
                var bytes = body.getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, bytes.length);
                exchange.getResponseBody().write(bytes);
            }
        });
        server.createContext("/long-poll", exchange -> {
            try (exchange) {
                polling.countDown();
                var body = "{\"ts\":\"2\",\"updates\":[]}".getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
        });
        server.start();
        var database = directory.resolve("saved.sqlite").toString();
        var properties = new MockEnvironment().withProperty("DATABASE_PATH", database)
                .withProperty("inboxpoint.vk.api-origin", origin);
        Files.writeString(directory.resolve("vk-settings.json"),
                "{\"accessToken\":\"synthetic-saved-token\",\"groupId\":123,\"pollTimeoutSeconds\":2}");
        var runtime = new TelegramRuntime(properties, new ClientInformation(database));
        try {
            runtime.start();
            assertThat(runtime.status().connected()).isFalse();
            assertThat(polling.await(7, TimeUnit.SECONDS)).isTrue();
            assertThat(runtime.vkStatus()).isEqualTo(new TelegramRuntime.Status(true, true, "local"));
            assertThat(requests.get()).isGreaterThanOrEqualTo(2);
        } finally {
            runtime.stop();
            server.stop(0);
        }
    }
}
