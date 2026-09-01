package com.inboxpoint.content;

import java.nio.file.Path;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientInformationTest {
    @TempDir
    Path directory;

    @Test
    void restoresCustomSectionsAndRejectsConflictingLabels() throws Exception {
        var database = directory.resolve("custom.sqlite").toString();
        var information = new ClientInformation(database);
        var input = JsonMapper.shared().createObjectNode();
        input.putArray("customSections").addObject().put("label", "  Правила  ").put("text", "  Возьмите форму  ");
        information.save(input);
        assertThat(information.resolve("Правила")).isEqualTo("Возьмите форму");
        assertThat(new ClientInformation(database).sections())
                .containsExactly(new ClientInformation.Section("Правила", "Возьмите форму"));
        input.withArray("customSections").addObject().put("label", "РАСПИСАНИЕ").put("text", "Conflict");
        assertThatThrownBy(() -> information.save(input)).isInstanceOf(IllegalArgumentException.class);
        assertThat(information.sections()).hasSize(1);
    }

    @Test
    void publishesTrimmedAnswersOnlyOnSuccessfulSaveAndRestoresThemAfterRestart() throws Exception {
        var database = directory.resolve("inbox.sqlite").toString();
        var catalog = new ClientInformation(database);
        assertThat(catalog.resolve("Расписание")).startsWith("Расписание пока не добавлено");
        var json = JsonMapper.shared();
        assertThat(catalog.save(json.createObjectNode().put("schedule", "  По субботам  ").put("prices", "")))
                .containsEntry("schedule", "По субботам").doesNotContainKey("prices");
        assertThatThrownBy(() -> catalog.save(json.createObjectNode().put("schedule", "x".repeat(4001))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(catalog.resolve("Расписание")).isEqualTo("По субботам");
        assertThat(new ClientInformation(database).resolve("Расписание")).isEqualTo("По субботам");
    }
}
