package com.inboxpoint.admin;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;

import com.inboxpoint.InboxPointApplication;
import com.inboxpoint.persistence.LegacySqlite;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

class AdminSessionEndpointTest {
    private static final String PASSWORD = "synthetic-admin-password";
    private static final String COOKIE = "__Host-inbox-point-admin-session";
    private static final String SESSION = "/api/admin/session";
    private static final String LOGIN = "/api/admin/login";
    private static final String REVOKE = "/api/admin/sessions/revoke-all";
    private static final String SETUP = "/api/setup/status";
    private static final String ORIGIN = "https://inboxpoint.test";

    @TempDir
    Path directory;

    @Test
    void acceptsRememberedSessionsFromTypeScriptAndPreservesTheWebContractAcrossRestart() throws Exception {
        var path = LegacySqlite.createVersion17(directory);
        seedTypeScriptSession(path);
        var existing = COOKIE + "=saved-node-token";
        String next;
        try (var app = start(path, "production", PASSWORD); var http = http()) {
            var initial = request(http, app, SESSION, null, null, null);
            assertThat(initial.statusCode()).isEqualTo(200);
            assertThat(initial.body()).contains("\"authenticated\":false", "\"mode\":\"password\"");
            assertThat(initial.headers().firstValue("cache-control")).contains("no-store");
            assertThat(initial.headers().firstValue("x-frame-options")).contains("DENY");
            assertThat(request(http, app, SETUP, null, null, null).statusCode()).isEqualTo(401);
            assertThat(request(http, app, SETUP, null, existing, null).statusCode()).isEqualTo(200);
            assertThat(request(http, app, SESSION, null, existing, null).body()).contains("\"authenticated\":true");
            assertThat(request(http, app, REVOKE, "{}", null, ORIGIN).statusCode()).isEqualTo(401);
            assertThat(request(http, app, REVOKE, "{}", existing, "https://other.test").statusCode()).isEqualTo(403);

            var login = request(http, app, LOGIN, "{\"password\":\"" + PASSWORD + "\",\"rememberDevice\":true}",
                    existing, ORIGIN);
            assertThat(login.statusCode()).isEqualTo(200);
            var cookie = login.headers().firstValue("Set-Cookie").orElseThrow();
            assertThat(cookie).startsWith(COOKIE + "=").contains("Path=/", "Max-Age=2592000", "HttpOnly", "SameSite=Strict", "Secure");
            next = cookie.split(";", 2)[0];
            assertThat(request(http, app, SESSION, null, existing, null).body()).contains("\"authenticated\":false");
        }
        try (var app = start(path, "production", PASSWORD); var http = http()) {
            assertThat(request(http, app, SESSION, null, next, null).body()).contains("\"authenticated\":true");
            var revoke = request(http, app, REVOKE, "{}", next, ORIGIN);
            assertThat(revoke.statusCode()).isEqualTo(200);
            assertThat(revoke.headers().firstValue("Set-Cookie")).get().asString().contains("Max-Age=0");
            assertThat(request(http, app, SESSION, null, next, null).body()).contains("\"authenticated\":false");
            assertThat(request(http, app, SETUP, null, next, null).statusCode()).isEqualTo(401);
        }
    }

    @Test
    void throttlesTheFifthAttemptAndKeepsUnconfiguredProductionAdminRoutesPrivate() throws Exception {
        var path = LegacySqlite.createVersion17(directory);
        try (var app = start(path, "production", PASSWORD); var http = http()) {
            for (int attempt = 0; attempt < 4; attempt++) {
                assertThat(request(http, app, LOGIN, "{\"password\":\"wrong\"}", null, ORIGIN).statusCode())
                        .isEqualTo(401);
            }
            var blocked = request(http, app, LOGIN, "{\"password\":\"wrong\"}", null, ORIGIN);
            assertThat(blocked.statusCode()).isEqualTo(429);
            assertThat(blocked.headers().firstValue("Retry-After")).contains("900");
        }
        try (var app = start(path, "production", ""); var http = http()) {
            assertThat(request(http, app, SESSION, null, null, null).statusCode()).isEqualTo(404);
            assertThat(request(http, app, "/manage", null, null, null).statusCode()).isEqualTo(404);
            assertThat(request(http, app, "/app.js", null, null, null).statusCode()).isEqualTo(404);
        }
    }

    @Test
    void servesTheEditorAndItsAssetsBeforeLoginWithoutExposingTheApi() throws Exception {
        var path = LegacySqlite.createVersion17(directory);
        Files.writeString(directory.resolve("index.html"), "<meta content=\"__INBOX_POINT_ORIGIN__\"><title>Inbox Point</title>");
        Files.writeString(directory.resolve("app.js"), "console.log('Inbox Point');");
        try (var app = start(path, "production", PASSWORD); var http = http()) {
            var page = request(http, app, "/manage", null, null, null);
            assertThat(page.statusCode()).isEqualTo(200);
            assertThat(page.body()).contains(ORIGIN, "<title>Inbox Point</title>").doesNotContain("__INBOX_POINT_ORIGIN__");
            assertThat(page.headers().firstValue("content-type")).get().asString().startsWith("text/html");
            assertThat(page.headers().firstValue("cache-control")).contains("no-store");
            assertThat(page.headers().firstValue("content-security-policy")).get().asString().contains("script-src 'self'", "frame-ancestors 'none'");
            assertThat(request(http, app, "/ops", null, null, null).body()).isEqualTo(page.body());
            assertThat(request(http, app, "/", null, null, null).body()).isEqualTo(page.body());
            var asset = request(http, app, "/app.js", null, null, null);
            assertThat(asset.statusCode()).isEqualTo(200);
            assertThat(asset.headers().firstValue("content-type")).get().asString().startsWith("application/javascript");
            assertThat(asset.headers().firstValue("cache-control")).contains("no-store");
            assertThat(asset.body()).isEqualTo("console.log('Inbox Point');");
            var missing = request(http, app, "/api/unknown", null, null, null);
            assertThat(missing.statusCode()).isEqualTo(404);
            assertThat(missing.body()).isEqualTo("{\"message\":\"Not found\"}");
            assertThat(request(http, app, "/api/manage/content", null, null, null).statusCode()).isEqualTo(401);
            assertThat(request(http, app, "/api/analytics", null, null, null).statusCode()).isEqualTo(401);
        }
    }

    private static void seedTypeScriptSession(Path path) throws Exception {
        try (var connection = LegacySqlite.connect(path);
                var insert = connection.prepareStatement("INSERT INTO remembered_admin_sessions VALUES (?, ?, ?)")) {
            insert.setString(1, "90dce521bff837dcfb79c761a439a8fdc39ee074be4339d4a9cfbf5070eb4db1");
            var now = Instant.now();
            insert.setLong(2, now.toEpochMilli());
            insert.setLong(3, now.plusSeconds(3600).toEpochMilli());
            insert.executeUpdate();
        }
    }

    private static HttpClient http() {
        return HttpClient.newBuilder().proxy(HttpClient.Builder.NO_PROXY).build();
    }

    private static ConfigurableApplicationContext start(Path database, String mode, String password) {
        return new SpringApplicationBuilder(InboxPointApplication.class).run("--server.port=0", "--server.address=127.0.0.1",
                "--spring.main.banner-mode=off", "--DATABASE_PATH=" + database, "--INBOXPOINT_ENV=" + mode,
                "--ADMIN_PASSWORD=" + password, "--VK_ENABLED=false", "--TELEGRAM_ENABLED=false", "--HTTP_TRUSTED_PROXIES=",
                "--inboxpoint.frontend.path=" + database.getParent());
    }

    private static HttpResponse<String> request(HttpClient http, ConfigurableApplicationContext app, String path,
            String body, String cookie, String origin) throws Exception {
        var port = app.getEnvironment().getRequiredProperty("local.server.port");
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(4))
                .header("X-Forwarded-For", "192.0.2.45").header("X-Forwarded-Host", "inboxpoint.test")
                .header("X-Forwarded-Proto", "https");
        if (cookie != null) {
            request.header("Cookie", cookie);
        }
        if (origin != null) {
            request.header("Origin", origin);
        }
        if (body != null) {
            request.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body));
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
