package com.inboxpoint.telegram;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientMessageQueueTest {
    @Test
    void serializesAConversationWithoutBlockingAnotherChannel() throws Exception {
        var queue = new ClientMessageQueue();
        var firstStarted = new CountDownLatch(1);
        var releaseFirst = new CountDownLatch(1);
        var secondQueued = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = pool.submit(() -> {
                queue.run("telegram", 42, () -> {
                    firstStarted.countDown();
                    if (!releaseFirst.await(3, TimeUnit.SECONDS)) {
                        throw new AssertionError("First question was not released");
                    }
                });
                return 1;
            });
            try {
                assertThat(firstStarted.await(3, TimeUnit.SECONDS)).isTrue();
                var second = pool.submit(() -> {
                    secondQueued.countDown();
                    queue.run("telegram", 42, () -> { });
                    return 2;
                });
                assertThat(secondQueued.await(3, TimeUnit.SECONDS)).isTrue();
                assertThatThrownBy(() -> second.get(100, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class);
                var independent = pool.submit(() -> {
                    queue.run("vk", 42, () -> { });
                    return 3;
                });
                assertThat(independent.get(3, TimeUnit.SECONDS)).isEqualTo(3);
                releaseFirst.countDown();
                assertThat(first.get(3, TimeUnit.SECONDS)).isEqualTo(1);
                assertThat(second.get(3, TimeUnit.SECONDS)).isEqualTo(2);
            } finally {
                releaseFirst.countDown();
            }
        }
    }
}
