package com.inboxpoint.operations;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

import com.inboxpoint.InboxPointApplication;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;

import static org.assertj.core.api.Assertions.assertThat;

class ChannelLifecycleTest {
    private static final String TOKEN = "501:synthetic-test-token";

    @TempDir
    Path directory;

    @Test
    void pollsBothSavedChannelsIndependentlyAndStopsThemWithTheSpringContext() throws Exception {
        Files.writeString(directory.resolve("telegram-settings.json"), """
                {"botToken":"%s","operatorChatId":-100123,"pollTimeoutSeconds":1}
                """.formatted(TOKEN));
        Files.writeString(directory.resolve("vk-settings.json"), """
                {"accessToken":"synthetic-vk-access-token","groupId":48,"pollTimeoutSeconds":1}
                """);
        try (var fixture = new Platforms(); var http = HttpClient.newHttpClient()) {
            try (var app = start(fixture)) {
                assertThat(fixture.vkPolling.await(5, TimeUnit.SECONDS)).isTrue();
                await(() -> fixture.telegramSends.get() == 1);
                fixture.allowVk.countDown();
                await(() -> ready(http, app));
                assertThat(request(http, app, "/ready").statusCode()).isEqualTo(200);
                assertThat(request(http, app, "/ready").body()).isEqualTo("{\"status\":\"ready\"}");
                assertThat(Files.readString(directory.resolve("service-control.json")))
                        .contains("expectedChannels", "telegram", "vk").doesNotContain(TOKEN, "synthetic-vk-access-token");
                assertThat(fixture.telegramPolls.get()).isPositive();
                assertThat(fixture.vkPolls.get()).isPositive();
            }

            Thread.sleep(150);
            var telegramPolls = fixture.telegramPolls.get();
            var vkPolls = fixture.vkPolls.get();
            Thread.sleep(200);
            assertThat(fixture.telegramPolls.get()).isEqualTo(telegramPolls);
            assertThat(fixture.vkPolls.get()).isEqualTo(vkPolls);
        }
    }

    @Test
    void discoversAndSwitchesChannelsThroughTheProtectedSetupRoutes() throws Exception {
        try (var fixture = new Platforms(); var app = start(fixture); var http = HttpClient.newHttpClient()) {
            await(() -> ready(http, app));
            var telegram = "{\"botToken\":\"" + TOKEN + "\",\"operatorChatId\":-100123}";
            var vk = "{\"accessToken\":\"synthetic-vk-access-token\",\"community\":\"https://vk.com/club48\"}";
            assertThat(setup(http, app, "POST", "/vk/connect", vk, null).statusCode()).isEqualTo(409);
            assertThat(setup(http, app, "POST", "/telegram/connect", telegram, "https://other.test").statusCode()).isEqualTo(403);
            var discovery = setup(http, app, "POST", "/telegram/discover", telegram, null);
            assertThat(discovery.statusCode()).isEqualTo(200);
            assertThat(discovery.body()).contains("Fixture Topics", "-100123", "\"isForum\":true");
            assertThat(setup(http, app, "POST", "/telegram/connect", telegram, null).statusCode()).isEqualTo(200);
            assertThat(setup(http, app, "POST", "/vk/connect", vk, null).statusCode()).isEqualTo(200);
            assertThat(Files.readString(directory.resolve("telegram-settings.json"))).contains("\"operatorChatId\"", "-100123");
            assertThat(Files.readString(directory.resolve("vk-settings.json"))).contains("\"groupId\"", "48");
            var status = setup(http, app, "GET", "/status", null, null);
            assertThat(status.statusCode()).isEqualTo(200);
            assertThat(status.body()).contains("\"source\":\"local\"", "\"expected\":true").doesNotContain(TOKEN);
            assertThat(setup(http, app, "DELETE", "/telegram", null, null).statusCode()).isEqualTo(409);
            assertThat(setup(http, app, "DELETE", "/vk", null, null).statusCode()).isEqualTo(200);
            assertThat(setup(http, app, "DELETE", "/telegram", null, null).statusCode()).isEqualTo(200);
            assertThat(directory.resolve("vk-settings.json")).doesNotExist();
            assertThat(directory.resolve("telegram-settings.json")).doesNotExist();
            assertThat(setup(http, app, "GET", "/status", null, null).body()).doesNotContain("expected");
        }
    }

    @Test
    void onlyTelegramUsesTheConfiguredProxy() throws Exception {
        Files.writeString(directory.resolve("telegram-settings.json"), """
                {"botToken":"invalid-local-token","operatorChatId":-100999,"pollTimeoutSeconds":9}
                """);
        Files.writeString(directory.resolve("vk-settings.json"), """
                {"accessToken":"synthetic-vk-access-token","groupId":48,"pollTimeoutSeconds":1}
                """);
        try (var platforms = new Platforms(); var proxy = new Platforms(); var http = HttpClient.newHttpClient()) {
            platforms.allowVk.countDown();
            try (var app = start(platforms, proxy.origin(), true)) {
                await(() -> platforms.vkPolls.get() > 0 && proxy.telegramSends.get() == 1);
                await(() -> ready(http, app));
                assertThat(request(http, app, "/ready").statusCode()).isEqualTo(200);
                assertThat(platforms.telegramPolls.get()).isZero();
                assertThat(proxy.vkPolls.get()).isZero();
            }
        }
    }

    @Test
    void keepsHealthAvailableWhenAnExpectedChannelsCredentialsAreMissing() throws Exception {
        Files.writeString(directory.resolve("service-control.json"), """
                {"channels":{"telegram":{"mode":"active"},"vk":{"mode":"active"}},
                 "delivery":{"mode":"active"},"expectedChannels":{"telegram":true,"vk":false}}
                """);
        try (var fixture = new Platforms(); var http = HttpClient.newHttpClient(); var app = start(fixture)) {
            assertThat(request(http, app, "/health").statusCode()).isEqualTo(200);
            await(() -> app.getBean(ChannelRuntime.class).status("telegram").expected());
            var ready = request(http, app, "/ready");
            assertThat(ready.statusCode()).isEqualTo(503);
            assertThat(ready.body()).isEqualTo("{\"status\":\"not_ready\"}");
            assertThat(fixture.telegramPolls.get()).isZero();
            assertThat(fixture.vkPolls.get()).isZero();
            assertThat(setup(http, app, "DELETE", "/telegram", null, null).statusCode()).isEqualTo(200);
            await(() -> ready(http, app));
        }
    }

    private ConfigurableApplicationContext start(Platforms fixture) {
        return start(fixture, null, false);
    }

    private ConfigurableApplicationContext start(Platforms fixture, URI proxy, boolean configureTelegramFromEnv) {
        return new SpringApplicationBuilder(InboxPointApplication.class, TestEndpoints.class)
                .initializers(context -> context.getBeanFactory().registerSingleton("platformFixture", fixture))
                .run("--server.port=0", "--server.address=127.0.0.1", "--spring.main.banner-mode=off",
                        "--DATABASE_PATH=" + directory.resolve("inbox.sqlite"), "--VK_ENABLED=false",
                        "--ADMIN_PASSWORD=", "--INBOXPOINT_ENV=test", "--HTTP_TRUSTED_PROXIES=",
                        "--TELEGRAM_ENABLED=" + configureTelegramFromEnv, "--TELEGRAM_BOT_TOKEN=" + TOKEN,
                        "--TELEGRAM_OPERATOR_CHAT_ID=-100123", "--TELEGRAM_POLL_TIMEOUT_SECONDS=1",
                        "--TELEGRAM_PROXY_URL=" + (proxy == null ? "" : proxy));
    }

    private static boolean ready(HttpClient http, ConfigurableApplicationContext app) {
        try {
            return request(http, app, "/ready").statusCode() == 200;
        } catch (Exception failure) {
            throw new IllegalStateException(failure);
        }
    }

    private static HttpResponse<String> setup(HttpClient http, ConfigurableApplicationContext app, String method,
            String path, String body, String origin) throws Exception {
        var port = app.getEnvironment().getRequiredProperty("local.server.port");
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/setup" + path))
                .timeout(Duration.ofSeconds(8)).method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                        : HttpRequest.BodyPublishers.ofString(body)).header("Content-Type", "application/json");
        if (origin != null) {
            request.header("Origin", origin);
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private static HttpResponse<String> request(HttpClient http, ConfigurableApplicationContext app, String path)
            throws Exception {
        var port = app.getEnvironment().getRequiredProperty("local.server.port");
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(3)).build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static void await(BooleanSupplier completed) throws InterruptedException {
        var deadline = System.nanoTime() + Duration.ofSeconds(5).toNanos();
        while (!completed.getAsBoolean() && System.nanoTime() < deadline) {
            Thread.sleep(25);
        }
        assertThat(completed.getAsBoolean()).isTrue();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestEndpoints {
        @Bean
        ChannelApiEndpoints testChannelEndpoints(Platforms fixture) {
            return new ChannelApiEndpoints(fixture.origin(), fixture.origin());
        }
    }

    private static final class Platforms implements AutoCloseable {
        private final HttpServer server;
        private final AtomicInteger telegramPolls = new AtomicInteger();
        private final AtomicInteger vkPolls = new AtomicInteger();
        private final AtomicInteger telegramSends = new AtomicInteger();
        private final CountDownLatch vkPolling = new CountDownLatch(1);
        private final CountDownLatch allowVk = new CountDownLatch(1);

        private Platforms() throws Exception {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.setExecutor(command -> Thread.startVirtualThread(command));
            server.createContext("/bot" + TOKEN + "/", exchange -> {
                try (exchange) {
                    var method = exchange.getRequestURI().getPath().substring(TOKEN.length() + 5);
                    var payload = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                    var result = switch (method) {
                        case "getMe" -> "{\"id\":501,\"is_bot\":true}";
                        case "getChat" -> "{\"id\":-100123,\"type\":\"supergroup\",\"is_forum\":true}";
                        case "getChatMember" -> "{\"status\":\"administrator\",\"can_manage_topics\":true}";
                        case "getWebhookInfo" -> "{\"url\":\"\"}";
                        case "getUpdates" -> payload.contains("my_chat_member") ? """
                                [{"my_chat_member":{"chat":{"id":-100123,"title":"Fixture Topics","type":"supergroup","is_forum":true}}}]
                                """ : telegramPolls.incrementAndGet() == 1 ? """
                                [{"update_id":32,"message":{"message_id":7,"chat":{"id":701,"type":"private"},
                                "from":{"id":701,"first_name":"Test","is_bot":false},"date":%d,"text":"/menu"}}]
                                """.formatted(Instant.now().getEpochSecond()) : "[]";
                        case "sendMessage" -> {
                            telegramSends.incrementAndGet();
                            yield "{\"message_id\":71}";
                        }
                        default -> throw new AssertionError(method);
                    };
                    respond(exchange, "{\"ok\":true,\"result\":" + result + "}");
                }
            });
            server.createContext("/method/", exchange -> {
                try (exchange) {
                    var body = switch (exchange.getRequestURI().getPath()) {
                        case "/method/groups.getLongPollSettings" -> """
                                {"response":{"is_enabled":true,"events":{"message_new":true,"message_reply":true}}}
                                """;
                        case "/method/groups.getTokenPermissions" -> """
                                {"response":{"mask":3,"permissions":[{"name":"manage","setting":1},{"name":"messages","setting":2}]}}
                                """;
                        case "/method/groups.getLongPollServer" -> """
                                {"response":{"key":"fixture-key","server":"%s/poll","ts":"100"}}
                                """.formatted(origin());
                        default -> throw new AssertionError(exchange.getRequestURI().getPath());
                    };
                    respond(exchange, body);
                }
            });
            server.createContext("/poll", exchange -> {
                try (exchange) {
                    var sequence = vkPolls.incrementAndGet();
                    vkPolling.countDown();
                    try {
                        allowVk.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException finished) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                    respond(exchange, "{\"ts\":" + (100 + sequence) + ",\"updates\":[]}");
                }
            });
            server.start();
        }

        private URI origin() {
            return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        }

        @Override
        public void close() {
            allowVk.countDown();
            server.stop(0);
        }

        private static void respond(com.sun.net.httpserver.HttpExchange exchange, String json) throws java.io.IOException {
            var body = json.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
        }
    }
}
