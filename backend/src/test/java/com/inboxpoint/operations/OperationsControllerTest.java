package com.inboxpoint.operations;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "INBOXPOINT_ENV=production", "OPS_ADMIN_PASSWORD=synthetic-ops-password", "TELEGRAM_ENABLED=false", "VK_ENABLED=false"
})
class OperationsControllerTest {
    @TempDir
    static Path directory;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("DATABASE_PATH", () -> directory.resolve("ops.sqlite").toString());
    }

    @Value("${local.server.port}")
    int port;

    @Test
    void protectsOperationalDetailsAndReportsChannelAndQueueStateToTheOperator() throws Exception {
        var base = "http://127.0.0.1:" + port + "/api/ops";
        try (var client = HttpClient.newHttpClient()) {
            var hidden = client.send(HttpRequest.newBuilder(URI.create(base + "/status")).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(hidden.statusCode()).isEqualTo(401);
            var login = client.send(HttpRequest.newBuilder(URI.create(base + "/login"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{\"password\":\"synthetic-ops-password\"}")).build(),
                    HttpResponse.BodyHandlers.ofString());
            assertThat(login.statusCode()).isEqualTo(200);
            var cookie = login.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
            assertThat(cookie).startsWith("__Host-mh-ops-session=");
            var current = client.send(HttpRequest.newBuilder(URI.create(base + "/status")).header("Cookie", cookie)
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(current.statusCode()).isEqualTo(200);
            var status = JsonMapper.shared().readTree(current.body());
            assertThat(status.path("state").asString()).isEqualTo("attention");
            assertThat(status.at("/channels/vk/configured").asBoolean()).isFalse();
            assertThat(status.at("/deliveries/failed").asLong()).isZero();
            assertThat(status.at("/deliveries/worker/state").asString()).isEqualTo("inactive");
        }
    }
}
