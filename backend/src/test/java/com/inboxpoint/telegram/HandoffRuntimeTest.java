package com.inboxpoint.telegram;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class HandoffRuntimeTest {
    @TempDir
    Path directory;

    @Test
    void fallbackTransfersAnExistingThreadToTheWebInbox() throws Exception {
        var runtime = new HandoffRuntime(directory.resolve("unused.sqlite"), () -> false, () -> null);
        var now = java.time.Instant.parse("2026-10-01T10:00:00Z");
        var clock = java.time.Clock.fixed(now, java.time.ZoneOffset.UTC);
        try (var store = new TelegramStore(directory.resolve("ownership.sqlite"))) {
            var original = new TelegramStore.Request("first", 123, 42, true, "vk");
            store.open(original, now);
            assertThat(store.activeOperatorRequests()).isEmpty();
            var service = new HandoffService(store, runtime.routingInbox(), clock, new ClientMessageQueue());
            service.processVk("later", 123, 57, "Customer", "Follow-up");
            assertThat(store.byTopic(42)).isNull();
            assertThat(store.byId("first").topic()).isEqualTo("web:first");
            assertThat(store.activeOperatorRequests()).extracting(TelegramRuntime.InboxRequest::id).containsExactly("first");
            service.relayReply(42, 89, "Late Telegram reply", "telegram:late");
            assertThat(store.pending(now, false, true)).isEmpty();
            service.relayReply(store.byId("first"), "web:close", "/close", "web:close");
            service.processVk("after-close", 123, 58, "Customer", "New question");
            assertThat(store.activeRequest("vk", 123).id()).isNotEqualTo("first");
        }
    }

    @Test
    void keepsTheConversationAndQueuesWebRepliesWithoutTelegram() throws Exception {
        var runtime = new HandoffRuntime(directory.resolve("unused.sqlite"), () -> false, () -> null);
        var now = java.time.Instant.parse("2026-10-01T10:00:00Z");
        var clock = java.time.Clock.fixed(now, java.time.ZoneOffset.UTC);
        try (var store = new TelegramStore(directory.resolve("web.sqlite"))) {
            var service = new HandoffService(store, runtime.routingInbox(), clock, new ClientMessageQueue());
            service.processVk("update", 123, 56, "Customer", "Question from VK");
            var request = store.activeRequest("vk", 123);
            assertThat(request.topic()).isEqualTo("web:" + request.id());
            assertThat(store.activeOperatorRequests()).singleElement().satisfies(view -> {
                assertThat(view.channel()).isEqualTo("vk");
                assertThat(view.displayName()).isEqualTo("Customer");
            });
            service.relayReply(request, "web:reply", "Operator answer", "web:reply");
            service.relayReply(request, "web:reply", "Operator answer", "web:reply");
            assertThat(store.operatorMessages(request.id())).hasSize(2).anySatisfy(message -> {
                assertThat(message.direction()).isEqualTo("operator_to_client");
                assertThat(message.deliveryStatus()).isEqualTo("pending");
            });
            assertThat(store.pending(now, false, true)).hasSize(1);
            service.relayReply(request, "web:close", "/close", "web:close");
            assertThat(store.activeOperatorRequests()).isEmpty();
        }
    }

    @Test
    void startsWithoutTelegramAndUnregistersOnlyTheCurrentInbox() throws Exception {
        var runtime = new HandoffRuntime(directory.resolve("service.sqlite"), () -> false, () -> null);
        var first = new TelegramTopicsInbox(null, 10);
        var second = new TelegramTopicsInbox(null, 20);
        var unregisterFirst = runtime.registerOperatorInbox(first);
        var unregisterSecond = runtime.registerOperatorInbox(second);
        unregisterFirst.run();
        assertThat(runtime.operatorInbox()).isSameAs(second);
        unregisterSecond.run();
        assertThat(runtime.operatorInbox()).isNull();
        try {
            runtime.start();
            assertThat(runtime.running()).isTrue();
        } finally {
            runtime.stop();
        }
        assertThat(runtime.running()).isFalse();
    }
}
