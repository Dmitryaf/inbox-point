package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import com.inboxpoint.content.ClientInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class EnrollmentRecoveryTest {
    private static final Instant NOW = Instant.parse("2026-10-12T12:00:00Z");

    @TempDir
    Path directory;

    @Test
    void savesTheChosenTextAcrossRestartAndRejectsWrongMessagesOrTopics() throws Exception {
        var file = directory.resolve("enrollment.sqlite");
        var request = new TelegramStore.Request("first", 123, "42", true, "vk");
        try (var store = new TelegramStore(file)) {
            store.beginQuestion("vk", 123, NOW.minusSeconds(2), "Танцы / Первая группа", null, "Ждём в понедельник.");
        }
        String enrollment;
        try (var store = new TelegramStore(file)) {
            var prompt = store.pendingApplication("vk", 123, NOW);
            assertThat(prompt.confirmation()).isEqualTo("Ждём в понедельник.");
            store.open(request, NOW);
            store.recordApplication(request, "vk:1", "Клиент", new TelegramStore.ApplicationText(prompt.label(),
                    "В понедельник", false, prompt.confirmation()), NOW);
            store.link(request.id(), "client_to_operator", "vk:1", "70", NOW);
            enrollment = store.enrollmentForMessage(request.id(), "vk:1");
            assertThat(store.confirmEnrollment(enrollment, "43", "70", NOW)).isEqualTo("unavailable");
            assertThat(store.confirmEnrollment(enrollment, "42", "71", NOW)).isEqualTo("unavailable");
            assertThat(store.pending(NOW, false, true)).isEmpty();
            assertThat(store.confirmEnrollment(enrollment, "42", "70", NOW)).isEqualTo("pending");
            assertThat(store.confirmEnrollment(enrollment, "42", "70", NOW)).isEqualTo("pending");
            assertThat(store.pending(NOW, false, true)).singleElement()
                    .satisfies(delivery -> assertThat(delivery.text()).isEqualTo("Ждём в понедельник."));
        }
        try (var store = new TelegramStore(file)) {
            store.changeStatus(request, false, NOW.plusSeconds(1));
            assertThat(store.confirmEnrollment(enrollment, "42", "70", NOW.plusSeconds(1))).isEqualTo("unavailable");
        }
    }

    @Test
    void operatorCallbacksRejectForeignGroupsAndBotAccounts() throws Exception {
        var clock = Clock.fixed(NOW, ZoneOffset.UTC);
        var file = directory.resolve("callbacks.sqlite");
        try (var bot = new TelegramTestServer(call -> TelegramTestServer.Response.ok("true"));
                var http = HttpClient.newHttpClient(); var store = new TelegramStore(file)) {
            var request = new TelegramStore.Request("first", 123, "42", true, "vk");
            store.open(request, NOW);
            store.recordApplication(request, "vk:1", "Клиент", new TelegramStore.ApplicationText("Группа", "День", false, "Готово"), NOW);
            store.link(request.id(), "client_to_operator", "vk:1", "70", NOW);
            var enrollment = store.enrollmentForMessage(request.id(), "vk:1");
            var api = new TelegramBotApi(http, bot.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(2));
            var router = new TelegramTextHandoff(-100123, store, api, clock, new ClientInformation(file.toString()));
            router.process(callback(enrollment, -100456, false));
            router.process(callback(enrollment, -100123, true));
            assertThat(store.pending(NOW, false, true)).isEmpty();
            router.process(callback(enrollment, -100123, false));
            router.process(callback(enrollment, -100123, false));
            assertThat(store.pending(NOW, false, true)).hasSize(1);
            assertThat(bot.requests()).hasSize(4).allSatisfy(call -> assertThat(call.method()).isEqualTo("answerCallbackQuery"));
        }
    }

    private static tools.jackson.databind.JsonNode callback(String enrollment, long group, boolean bot) {
        var update = JsonMapper.shared().createObjectNode().put("update_id", 12);
        var callback = update.putObject("callback_query").put("id", "approval").put("data", "enroll:" + enrollment);
        callback.putObject("from").put("id", 6).put("is_bot", bot);
        var message = callback.putObject("message").put("message_id", 70).put("message_thread_id", 42);
        message.putObject("chat").put("id", group).put("type", "supergroup");
        return update;
    }
}
