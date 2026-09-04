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
    void upgradesVersionOneAndRecordsOnlyChangedSections() throws Exception {
        var database = directory.resolve("history.sqlite").toString();
        java.nio.file.Files.writeString(directory.resolve("content-settings.json"),
                "{\"version\":1,\"prices\":\"150\"}");
        var info = new ClientInformation(database);
        assertThat(info.resolve("Цены")).contains("• 150");
        var changes = JsonMapper.shared().createObjectNode().put("prices", "150");
        changes.putArray("faq").addObject().put("question", "Как прийти?").put("answer", "К девяти.");
        info.save(changes);
        info.save(changes);
        var restored = new ClientInformation(database);
        assertThat(restored.resolve("Частые вопросы")).contains("❓ Как прийти?", "К девяти.");
        assertThat(restored.history()).singleElement()
                .satisfies(change -> assertThat(change.sections()).containsExactly("faq"));
    }

    @Test
    void restoresASavedRevisionAfterRestartAndRecordsTheRestore() throws Exception {
        var database = directory.resolve("revision.sqlite").toString();
        var info = new ClientInformation(database);
        info.save(JsonMapper.shared().createObjectNode().put("address", "First"));
        info.save(JsonMapper.shared().createObjectNode().put("address", "Second"));
        var restored = new ClientInformation(database);
        assertThat(restored.restore(99)).isFalse();
        assertThat(restored.restore(1)).isTrue();
        assertThat(restored.resolve("Адрес")).isEqualTo("First");
        assertThat(restored.history()).extracting(ClientInformation.Change::revision).containsExactly(3, 2, 1);
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
        assertThat(catalog.resolve("Расписание")).contains("• По субботам");
        assertThat(new ClientInformation(database).resolve("Расписание")).contains("• По субботам");
    }
}
