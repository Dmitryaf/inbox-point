package com.inboxpoint.content;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

import com.inboxpoint.InboxPointApplication;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class ContentManagementEndpointTest {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final String ROOT = "/api/manage/content";
    private static final String ORIGINAL_VERSION = "22553f4c17c2e869f91e029b7263f546067ba0ddab2504e21c221c7413b11ebb";

    @TempDir
    Path directory;

    @Test
    void preservesTypeScriptVersionsSerializesConcurrentEditsAndRestoresAsANewRevision() throws Exception {
        var file = directory.resolve("content-settings.json");
        var initial = """
                {"organizationName":"Студия","address":"Старый адрес","faq":[{"question":"Можно?","answer":"Да"}],
                 "visibleSections":["address","faq"]}
                """;
        Files.writeString(file, "{\"content\":" + initial + ",\"history\":[{\"revision\":7,"
                + "\"changedAt\":\"2026-10-01T10:00:00.000Z\",\"sections\":[\"address\"],\"content\":" + initial + "}]}");
        try (var app = start(); var http = HttpClient.newHttpClient()) {
            var loaded = send(http, app, "", null);
            assertThat(loaded.statusCode()).isEqualTo(200);
            assertThat(loaded.headers().firstValue("cache-control")).contains("no-store");
            var snapshot = JSON.readTree(loaded.body());
            assertThat(snapshot.path("version").asString()).isEqualTo(ORIGINAL_VERSION);
            assertThat(snapshot.at("/content/scheduleItems").isArray()).isTrue();
            var first = http.sendAsync(request(app, "", save("  Новый адрес  ", ORIGINAL_VERSION)), HttpResponse.BodyHandlers.ofString());
            var second = http.sendAsync(request(app, "", save("  Другой адрес  ", ORIGINAL_VERSION)), HttpResponse.BodyHandlers.ofString());
            var results = List.of(first.get(), second.get()).stream().sorted(Comparator.comparingInt(HttpResponse::statusCode)).toList();
            assertThat(results).extracting(HttpResponse::statusCode).containsExactly(200, 409);
            var saved = JSON.readTree(results.getFirst().body());
            var savedVersion = saved.path("version").asString();
            assertThat(saved.at("/content/organizationName").asString()).isEqualTo("Студия");
            assertThat(saved.at("/content/address").asString()).isIn("Новый адрес", "Другой адрес");
            var history = JSON.readTree(send(http, app, "/history", null).body());
            assertThat(history.at("/history/0/revision").asInt()).isEqualTo(8);
            assertThat(history.at("/history/0/sections/0").asString()).isEqualTo("address");
            assertThat(history.at("/history/0/content").isMissingNode()).isTrue();
            assertThat(JSON.readTree(send(http, app, "/history/7", null).body()).path("version").asString())
                    .isEqualTo(ORIGINAL_VERSION);
            assertThat(send(http, app, "/restore", restore(7, ORIGINAL_VERSION)).statusCode()).isEqualTo(409);
            assertThat(send(http, app, "/restore", restore(999, savedVersion)).statusCode()).isEqualTo(404);
            var restored = send(http, app, "/restore", restore(7, savedVersion));
            assertThat(restored.statusCode()).isEqualTo(200);
            assertThat(JSON.readTree(restored.body()).path("version").asString()).isEqualTo(ORIGINAL_VERSION);
            assertThat(JSON.readTree(Files.readString(file)).at("/history/0/revision").asInt()).isEqualTo(9);
            assertThat(new ClientMenu(ClientCatalog.load(file)).resolve("Адрес", "address",
                    new ClientMenu.State(ClientMenu.Stage.FIRST_CONTACT, false, false)).orElseThrow().text())
                    .contains("Старый адрес");
        }
    }

    @Test
    void verifiesTheOriginalBackupBeforeMigratingTheScheduleAndItsHistory() throws Exception {
        var file = directory.resolve("content-settings.json");
        var content = """
                {"schedule":"Бачата парная (начинающие) — Пн 18:00\\nНеизвестное — Вт 19:00",
                 "scheduleItems":[{"title":"Бачата парная (начинающие)","dayTime":"Пн 18:00"},
                                  {"title":"Неизвестное","dayTime":"Вт 19:00"}]}
                """;
        var original = "{\"content\":" + content + ",\"history\":[{\"revision\":7,"
                + "\"changedAt\":\"2026-10-01T10:00:00Z\",\"sections\":[\"schedule\"],\"content\":" + content + "}]}";
        Files.writeString(file, original);
        var hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(original.getBytes(StandardCharsets.UTF_8)));
        var backup = directory.resolve("content-settings.json.before-classes-" + hash + ".json");
        Files.writeString(backup, "mismatched fixture");
        try (var app = start(); var http = HttpClient.newHttpClient()) {
            assertThat(send(http, app, "/history", null).statusCode()).isEqualTo(500);
            assertThat(Files.readString(file)).isEqualTo(original);
            Files.writeString(backup, original);
            var response = send(http, app, "", null);
            assertThat(response.statusCode()).isEqualTo(200);
            var document = JSON.readTree(response.body());
            assertThat(document.at("/content/groups/0/enrollmentOpen").booleanValue()).isFalse();
            assertThat(document.at("/content/groups/1/review/source").asString()).isEqualTo("Неизвестное\nВт 19:00");
            var revision = JSON.readTree(send(http, app, "/history/7", null).body());
            assertThat(revision.at("/content/groups/0/id")).isEqualTo(document.at("/content/groups/0/id"));
            assertThat(Files.readString(backup)).isEqualTo(original);
            var persisted = JSON.readTree(Files.readString(file));
            assertThat(persisted.path("formatVersion").asInt()).isEqualTo(3);
            assertThat(persisted.at("/content/schedule").isMissingNode()).isTrue();
            var oldEditor = save("Адрес", document.path("version").asString()).replace("\"schedule\":\"\"", "\"schedule\":\"Пн 18:00\"");
            assertThat(send(http, app, "", oldEditor).statusCode()).isEqualTo(409);
        }
    }

    private ConfigurableApplicationContext start() {
        return new SpringApplicationBuilder(InboxPointApplication.class).run("--server.port=0", "--server.address=127.0.0.1",
                "--spring.main.banner-mode=off", "--DATABASE_PATH=" + directory.resolve("inbox.sqlite"),
                "--INBOXPOINT_ENV=test", "--ADMIN_PASSWORD=", "--TELEGRAM_ENABLED=false", "--VK_ENABLED=false", "--HTTP_TRUSTED_PROXIES=");
    }

    private static HttpResponse<String> send(HttpClient http, ConfigurableApplicationContext app, String path, String body)
            throws Exception {
        return http.send(request(app, path, body), HttpResponse.BodyHandlers.ofString());
    }

    private static HttpRequest request(ConfigurableApplicationContext app, String path, String body) {
        var port = app.getEnvironment().getRequiredProperty("local.server.port");
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + ROOT + path)).timeout(Duration.ofSeconds(5));
        return (body == null ? request.GET() : request.header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))).build();
    }

    private static String save(String address, String version) {
        return """
                {"version":"%s","content":{"address":"%s","faq":[{"question":"Можно?","answer":"Да"}],
                 "prices":"","schedule":"","scheduleItems":[],"visibleSections":["address","faq"]}}
                """.formatted(version, address);
    }

    private static String restore(long revision, String version) {
        return "{\"revision\":" + revision + ",\"version\":\"" + version + "\"}";
    }
}
