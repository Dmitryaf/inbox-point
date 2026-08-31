package com.inboxpoint.operations;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "server.address=127.0.0.1")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class HealthEndpointTest {
    @TempDir
    static Path directory;

    @DynamicPropertySource
    static void isolatedRuntime(DynamicPropertyRegistry properties) {
        properties.add("DATABASE_PATH", () -> directory.resolve("inbox.sqlite").toString());
        properties.add("VK_ENABLED", () -> "false");
        properties.add("TELEGRAM_ENABLED", () -> "false");
    }

    @Value("${local.server.port}")
    private int port;

    @Test
    void exposesProcessHealthWithTheExistingJsonContract() {
        var response = RestClient.create("http://127.0.0.1:" + port)
                .get()
                .uri("/health")
                .retrieve()
                .toEntity(String.class);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getContentType().toString()).startsWith("application/json");
        assertThat(response.getBody()).isEqualTo("{\"status\":\"ok\"}");
    }
}
