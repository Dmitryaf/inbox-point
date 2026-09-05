package com.inboxpoint.operations;

import java.nio.file.Path;
import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalServiceControlTest {
    @TempDir
    Path directory;

    @Test
    void preservesIndependentChannelIntakeAcrossRestart() throws Exception {
        var file = directory.resolve("instance.sqlite");
        var control = new LocalServiceControl(file);
        var time = Instant.parse("2026-09-01T08:00:00Z");
        assertThat(control.intakePaused("telegram")).isFalse();
        control.set("telegram", true, time);
        var restored = new LocalServiceControl(file);
        assertThat(restored.intakePaused("telegram")).isTrue();
        assertThat(restored.intakePaused("vk")).isFalse();
        assertThat(restored.current().channels().get("telegram").changedAt()).isEqualTo(time.toString());
        assertThatThrownBy(() -> restored.set("unknown", true, time)).isInstanceOf(IllegalArgumentException.class);
        restored.set("telegram", false, time.plusSeconds(1));
        assertThat(new LocalServiceControl(file).intakePaused("telegram")).isFalse();
    }
}
