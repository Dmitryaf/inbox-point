package com.inboxpoint.telegram;

import java.net.http.HttpClient;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OperatorRelayRestartTest {
    @TempDir
    Path directory;

    @Test
    void holdsAnUnconfirmedQuestionAcrossRestartUntilTheOperatorResolvesIt() throws Exception {
        var database = directory.resolve("relay.sqlite");
        var now = Instant.parse("2026-09-12T12:00:00Z");
        var clock = Clock.fixed(now, ZoneOffset.UTC);
        try (var bot = new TelegramTestServer(call -> switch (call.method()) {
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
            case "sendMessage" -> new TelegramTestServer.Response(500, "{\"ok\":false,\"error_code\":500}");
            default -> throw new AssertionError(call.method());
        }); var client = HttpClient.newHttpClient()) {
            var api = new TelegramBotApi(client, bot.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var inbox = new DurableTelegramInbox(new TelegramTopicsInbox(api, -100123), database, clock);
            String requestId;
            String action;
            try (var store = new TelegramStore(database)) {
                new HandoffService(store, inbox, clock, new ClientMessageQueue())
                        .processVk("incoming", 123, 5, "Synthetic", "Question");
                var request = store.activeRequest("vk", 123);
                requestId = request.id();
                assertThat(request.topic()).isEqualTo("42");
                assertThat(store.pending(now, false, true)).isEmpty();
                var incidents = store.operatorActions().status().incidents();
                assertThat(incidents).hasSize(1);
                action = incidents.getFirst().id();
                assertThat(incidents.getFirst().confirmable()).isTrue();
            }
            try (var restarted = new TelegramStore(database)) {
                restarted.recoverInterrupted();
                assertThat(restarted.operatorActions().status().uncertain()).isEqualTo(1);
                assertThatThrownBy(() -> inbox.relay(requestId, "42", "123:5", 0, true, "Question"))
                        .isInstanceOf(DurableTelegramInbox.UnknownOutcome.class);
                assertThat(bot.requests()).hasSize(2);
                assertThat(restarted.resolveOperatorAction(action, true, now)).isTrue();
                assertThat(restarted.resolveOperatorAction(action, false, now)).isFalse();
                assertThat(restarted.operatorActions().status().uncertain()).isZero();
                assertThat(restarted.pending(now, false, true)).singleElement()
                        .satisfies(item -> assertThat(item.text()).isEqualTo(HandoffService.ACKNOWLEDGEMENT));
            }
        }
    }
}
