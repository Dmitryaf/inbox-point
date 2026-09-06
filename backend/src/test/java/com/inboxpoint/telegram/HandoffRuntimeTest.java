package com.inboxpoint.telegram;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class HandoffRuntimeTest {
    @TempDir
    Path directory;

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
