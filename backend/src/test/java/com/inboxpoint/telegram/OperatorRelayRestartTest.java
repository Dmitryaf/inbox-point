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
    void newRequestReleasesHeldRepliesUnderTheirOriginalRequest() throws Exception {
        var now = Instant.parse("2026-09-16T09:00:00Z");
        try (var store = new TelegramStore(directory.resolve("superseded-replies.sqlite"))) {
            var previous = new TelegramStore.Request("previous", 123, "42", true, "vk");
            store.open(previous, now.minusSeconds(5));
            store.changeStatus(previous, false, now);
            var late = store.holdReply(store.byId(previous.id()), "event", "501", "Earlier reply", now);
            var next = new TelegramStore.Request("next", 123, "web:next", true, "vk");
            assertThat(store.openNext(next, "Synthetic", now.plusSeconds(1))).isTrue();
            assertThat(store.activeRequest("vk", 123).id()).isEqualTo(next.id());
            assertThat(store.byId(previous.id()).active()).isFalse();
            assertThat(store.operatorActions().incident(late.actionId())).isNull();
            assertThat(store.pending(now.plusSeconds(1), false, true)).singleElement()
                    .satisfies(reply -> assertThat(reply.request()).isEqualTo(previous.id()));
        }
    }

    @Test
    void releasesSavedLateRepliesOnceAfterAnUncertainReopen() throws Exception {
        var now = Instant.parse("2026-09-16T09:00:00Z");
        var database = directory.resolve("held-replies.sqlite");
        var request = new TelegramStore.Request("late", 123, "42", true, "vk");
        String action;
        try (var store = new TelegramStore(database)) {
            store.open(request, now.minusSeconds(10));
            store.changeStatus(request, false, now);
            var closed = store.byId(request.id());
            action = store.holdReply(closed, "event-one", "501", "First reply", now).actionId();
            assertThat(store.operatorActions().begin(action, now)).isTrue();
        }
        try (var store = new TelegramStore(database)) {
            store.recoverInterrupted();
            store.holdReply(store.byId(request.id()), "event-two", "502", "Second reply", now);
            assertThat(store.operatorActions().incident(action).heldReplyCount()).isEqualTo(2);
            assertThat(store.pending(now, false, true)).isEmpty();
            assertThat(store.resolveOperatorAction(action, "completed", now)).isTrue();
            assertThat(store.resolveOperatorAction(action, "completed", now)).isFalse();
            assertThat(store.pending(now, false, true)).extracting(TelegramStore.Pending::text)
                    .containsExactlyInAnyOrder("First reply", "Second reply");
        }
    }

    @Test
    void movesOnlyUnclaimedActiveWebRequests() throws Exception {
        var now = Instant.parse("2026-09-16T09:00:00Z");
        try (var store = new TelegramStore(directory.resolve("ownership.sqlite"))) {
            var first = new TelegramStore.Request("first", 123, "web:first", true, "vk");
            var second = new TelegramStore.Request("second", 124, "web:second", true, "vk");
            store.open(first, now);
            store.open(second, now);
            assertThat(store.claimWebRequest(first.id(), first.topic(), now)).isTrue();
            assertThat(store.recoverWebRequest(first.id(), first.topic(), "42")).isFalse();
            assertThat(store.recoverWebRequest(second.id(), second.topic(), "43")).isTrue();
            assertThat(store.claimWebRequest(second.id(), second.topic(), now)).isFalse();
            assertThat(store.byId(first.id()).topic()).isEqualTo(first.topic());
            assertThat(store.byId(second.id()).topic()).isEqualTo("43");
        }
    }

    @Test
    void keepsTheRequestOpenAfterAnUncertainCloseUntilAnOperatorConfirmsIt() throws Exception {
        var now = Instant.parse("2026-10-01T10:00:00Z");
        try (var store = new TelegramStore(directory.resolve("lifecycle.sqlite"))) {
            var request = new TelegramStore.Request("case-1", 123, 42, true, "vk");
            store.open(request, now);
            var actions = store.operatorActions();
            actions.prepare(new OperatorActions.Key("close-case", request.id(), "close_request", "42", "event", 0, false), now);
            assertThat(actions.begin("close-case", now)).isTrue();
            store.recoverInterrupted();
            assertThat(store.byId(request.id()).active()).isTrue();
            assertThat(store.resolveOperatorAction("close-case", "completed", now)).isTrue();
            assertThat(store.byId(request.id()).active()).isFalse();
            assertThat(store.clientStage("vk", 123, now)).isEqualTo(ClientMenuPolicy.Stage.CLOSED);
            store.beginQuestion("vk", 123, now);
            assertThat(store.clientStage("vk", 123, now)).isEqualTo(ClientMenuPolicy.Stage.AWAITING);
            assertThat(store.clientStage("vk", 123, now.plusSeconds(7201))).isEqualTo(ClientMenuPolicy.Stage.CLOSED);
        }
    }

    @Test
    void recoversUnansweredWebRequestsOnceAndKeepsConversationsWithWebReplies() throws Exception {
        var database = directory.resolve("web-recovery.sqlite");
        var now = Instant.parse("2026-10-01T10:00:00Z");
        var clock = Clock.fixed(now, ZoneOffset.UTC);
        try (var bot = new TelegramTestServer(call -> switch (call.method()) {
            case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
            case "sendMessage" -> TelegramTestServer.Response.message(101);
            default -> throw new AssertionError(call.method());
        }); var client = HttpClient.newHttpClient(); var store = new TelegramStore(database)) {
            var queue = new ClientMessageQueue();
            var web = new HandoffService(store, new EmergencyOperatorInbox(), clock, queue);
            web.processVk("incoming", 123, 5, "Synthetic", "Question");
            web.processVk("already-replied", 124, 6, "Synthetic", "Question with a reply");
            var responded = store.activeRequest("vk", 124);
            web.relayReply(responded, "web:reply", "Answer in the browser", "web:reply");
            assertThat(store.openWebRequests()).isEqualTo(2);
            var api = new TelegramBotApi(client, bot.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var telegram = new HandoffService(store, new DurableTelegramInbox(new TelegramTopicsInbox(api, -100123), database, clock), clock, queue);
            telegram.recoverWebRequests();
            telegram.recoverWebRequests();
            assertThat(store.openWebRequests()).isEqualTo(1);
            assertThat(store.activeRequest("vk", 123).topic()).isEqualTo("42");
            assertThat(store.activeRequest("vk", 124).topic()).isEqualTo(responded.topic());
            assertThat(bot.requests()).extracting(TelegramTestServer.Request::method).containsExactly("createForumTopic", "sendMessage");
            assertThat(store.pending(now, false, true)).extracting(TelegramStore.Pending::text)
                    .contains(HandoffService.DELAYED, HandoffService.RECOVERED);
        }
    }

    @Test
    void reusesTheClosedRequestTopicWithoutReopeningTheOldRequestRecord() throws Exception {
        var database = directory.resolve("topic.sqlite");
        var now = Instant.parse("2026-10-01T10:00:00Z");
        var clock = Clock.fixed(now, ZoneOffset.UTC);
        try (var bot = new TelegramTestServer(call -> switch (call.method()) {
            case "reopenForumTopic" -> TelegramTestServer.Response.ok("true");
            case "sendMessage" -> TelegramTestServer.Response.message(101);
            default -> throw new AssertionError(call.method());
        }); var client = HttpClient.newHttpClient(); var store = new TelegramStore(database)) {
            var original = new TelegramStore.Request("original", 123, 42, true, "vk");
            store.open(original, now.minusSeconds(90));
            store.changeStatus(original.id(), false, now.minusSeconds(30));
            var api = new TelegramBotApi(client, bot.origin(), TelegramTestServer.TOKEN, Duration.ofSeconds(3));
            var inbox = new DurableTelegramInbox(new TelegramTopicsInbox(api, -100123), database, clock);
            var service = new HandoffService(store, inbox, clock, new ClientMessageQueue());
            service.processVk("new", 123, 5, "Synthetic", "Second question");
            var current = store.byTopic(42);
            assertThat(current.id()).isNotEqualTo(original.id());
            assertThat(current.active()).isTrue();
            assertThat(store.byId(original.id()).active()).isFalse();
            service.reconcileTopic(42, "stale-closing", false, now.minusSeconds(15));
            assertThat(store.byTopic(42).active()).isTrue();
            assertThat(bot.requests()).extracting(TelegramTestServer.Request::method).containsExactly("reopenForumTopic", "sendMessage");
        }
    }

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
