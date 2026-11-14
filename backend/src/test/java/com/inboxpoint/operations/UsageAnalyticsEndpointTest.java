package com.inboxpoint.operations;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.temporal.ChronoUnit;

import com.inboxpoint.InboxPointApplication;
import com.inboxpoint.persistence.LegacySqlite;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class UsageAnalyticsEndpointTest {
    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();

    @TempDir
    Path directory;

    @Test
    void reportsHistoricalUsageByUtcDayAndChannelUsingTheLatestLabelInThePeriod() throws Exception {
        var database = LegacySqlite.createVersion17(directory);
        var today = Instant.now().truncatedTo(ChronoUnit.DAYS);
        var first = today.minus(6, ChronoUnit.DAYS);
        seed(database, first, today);
        try (var app = new SpringApplicationBuilder(InboxPointApplication.class).run("--server.port=0",
                "--server.address=127.0.0.1", "--spring.main.banner-mode=off", "--DATABASE_PATH=" + database,
                "--INBOXPOINT_ENV=test", "--ADMIN_PASSWORD=", "--VK_ENABLED=false", "--TELEGRAM_ENABLED=false", "--HTTP_TRUSTED_PROXIES=");
                var http = HttpClient.newBuilder().proxy(HttpClient.Builder.NO_PROXY).build()) {
            var url = "http://127.0.0.1:" + app.getEnvironment().getRequiredProperty("local.server.port") + "/api/analytics";
            var response = get(http, url + "?period=7d");
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.headers().firstValue("cache-control")).contains("no-store");
            var json = JsonMapper.shared().readTree(response.body());
            assertThat(json.path("recordedSince").asString()).isEqualTo(timestamp(first));
            assertThat(json.path("timeZone").asString()).isEqualTo("UTC");
            assertThat(json.path("daily").size()).isEqualTo(7);
            assertThat(json.at("/daily/0/date").asString()).isEqualTo(first.atZone(ZoneOffset.UTC).toLocalDate().toString());
            assertThat(json.at("/daily/0/requests").intValue()).isEqualTo(1);
            assertThat(json.at("/daily/1/requests").intValue()).isZero();
            assertThat(json.at("/daily/1/menuActions").intValue()).isZero();
            assertThat(json.at("/summary/requests").intValue()).isEqualTo(2);
            assertThat(json.at("/summary/menuActions").intValue()).isEqualTo(3);
            assertThat(json.path("lastRequestAt").asString()).isEqualTo(timestamp(today.minus(2, ChronoUnit.DAYS)));
            assertThat(json.at("/actions/0/label").asString()).isEqualTo("Записаться на пробное");
            assertThat(json.at("/actions/0/count").intValue()).isEqualTo(2);
            assertThat(json.at("/actions/0/telegram").intValue()).isEqualTo(1);
            assertThat(json.at("/actions/0/vk").intValue()).isEqualTo(1);

            var vk = JsonMapper.shared().readTree(get(http, url + "?channel=vk").body());
            assertThat(vk.path("period").asString()).isEqualTo("30d");
            assertThat(vk.path("daily").size()).isEqualTo(30);
            assertThat(vk.at("/channels/telegram/requests").intValue()).isZero();
            assertThat(vk.at("/summary/requests").intValue()).isEqualTo(1);
            assertThat(vk.at("/summary/menuActions").intValue()).isEqualTo(2);
            var telegram = JsonMapper.shared().readTree(get(http, url + "?period=90d&channel=telegram").body());
            assertThat(telegram.path("daily").size()).isEqualTo(90);
            assertThat(telegram.at("/summary/requests").intValue()).isEqualTo(2);
            assertThat(telegram.at("/actions/0/label").asString()).isEqualTo("Пробное занятие");
            for (var query : new String[]{"period=14d", "channel=email", "period=7d&period=30d", "extra=value"}) {
                assertThat(get(http, url + "?" + query).statusCode()).isEqualTo(400);
            }
        }
    }

    private static void seed(Path path, Instant first, Instant today) throws Exception {
        try (var connection = LegacySqlite.connect(path);
                var insert = connection.prepareStatement("""
                        INSERT INTO usage_events (id, event_type, channel, occurred_at, action_key, action_label)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """)) {
            var earlier = today.minus(3, ChronoUnit.DAYS);
            var last = today.minus(2, ChronoUnit.DAYS);
            String[][] events = {
                    {"old", "new_request", "telegram", timestamp(first.minusMillis(1)), null, null},
                    {"boundary", "new_request", "telegram", timestamp(first), null, null},
                    {"request", "new_request", "vk", timestamp(last), null, null},
                    {"earlier", "menu_action", "telegram", timestamp(earlier), "custom:stable", "Пробное занятие"},
                    {"later", "menu_action", "vk", timestamp(last), "custom:stable", "Записаться на пробное"},
                    {"question", "menu_action", "vk", timestamp(last), "handoff", "Задать вопрос"},
                    {"legacy", "information_section", "telegram", timestamp(last), null, null},
                    {"operational", "delivery_failure", "vk", timestamp(last), null, null},
                    {"future", "new_request", "vk", timestamp(today.plus(1, ChronoUnit.DAYS)), null, null},
            };
            for (var event : events) {
                for (int index = 0; index < event.length; index++) {
                    insert.setString(index + 1, event[index]);
                }
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static String timestamp(Instant value) {
        return TIMESTAMP.format(value);
    }

    private static HttpResponse<String> get(HttpClient http, String url) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(url)).build(), HttpResponse.BodyHandlers.ofString());
    }
}
