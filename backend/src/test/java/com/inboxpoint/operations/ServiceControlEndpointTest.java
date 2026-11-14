package com.inboxpoint.operations;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;

import com.inboxpoint.InboxPointApplication;
import com.inboxpoint.persistence.LegacySqlite;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class ServiceControlEndpointTest {
    private static final JsonMapper JSON = JsonMapper.shared();

    @TempDir
    Path directory;

    @Test
    void persistsIndependentIntakeAndDeliveryChangesAcrossRestart() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        var file = directory.resolve("service-control.json");
        Files.writeString(file, """
                {"channels":{"telegram":{"mode":"active"},"vk":{"mode":"active"}},
                 "delivery":{"mode":"active"},"expectedChannels":{"telegram":true,"vk":false}}
                """);
        try (var app = start(database); var http = newHttp()) {
            var request = request(app, "").build();
            var response = http.send(request, HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(JSON.readTree(response.body()).at("/expectedChannels/telegram").booleanValue()).isTrue();
            var pauseIntake = http.sendAsync(post(app, "/vk/pause"), HttpResponse.BodyHandlers.ofString());
            var pauseDelivery = http.sendAsync(post(app, "/delivery/pause"), HttpResponse.BodyHandlers.ofString());
            assertThat(pauseIntake.get().statusCode()).isEqualTo(200);
            assertThat(pauseDelivery.get().statusCode()).isEqualTo(200);
            var state = JSON.readTree(Files.readString(file));
            assertThat(state.at("/channels/vk/mode").asString()).isEqualTo("paused");
            assertThat(state.at("/delivery/mode").asString()).isEqualTo("paused");
            assertThat(state.at("/delivery/changedAt").asString()).matches(".*\\.\\d{3}Z");
            assertThat(state.at("/expectedChannels/telegram").booleanValue()).isTrue();
            assertThat(http.send(post(app, "/other/pause"), HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(404);
            var crossOrigin = request(app, "/delivery/resume").header("Origin", "https://different.test")
                    .POST(HttpRequest.BodyPublishers.noBody()).build();
            assertThat(http.send(crossOrigin, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
        }
        try (var app = start(database); var http = newHttp()) {
            var response = http.send(post(app, "/delivery/resume"), HttpResponse.BodyHandlers.ofString());
            assertThat(response.statusCode()).isEqualTo(200);
            var state = JSON.readTree(response.body());
            assertThat(state.at("/channels/vk/mode").asString()).isEqualTo("paused");
            assertThat(state.at("/delivery/mode").asString()).isEqualTo("active");
            assertThat(state).isEqualTo(JSON.readTree(Files.readString(file)));
        }
    }

    private static ConfigurableApplicationContext start(Path database) {
        return new SpringApplicationBuilder(InboxPointApplication.class).run("--server.port=0", "--server.address=127.0.0.1",
                "--spring.main.banner-mode=off", "--DATABASE_PATH=" + database, "--INBOXPOINT_ENV=test", "--ADMIN_PASSWORD=",
                "--VK_ENABLED=false", "--TELEGRAM_ENABLED=false", "--HTTP_TRUSTED_PROXIES=");
    }

    private static HttpClient newHttp() {
        return HttpClient.newBuilder().proxy(HttpClient.Builder.NO_PROXY).build();
    }

    private static HttpRequest.Builder request(ConfigurableApplicationContext app, String path) {
        var port = app.getEnvironment().getRequiredProperty("local.server.port");
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/ops/service-control" + path));
    }

    private static HttpRequest post(ConfigurableApplicationContext app, String path) {
        return request(app, path).POST(HttpRequest.BodyPublishers.noBody()).build();
    }
}
