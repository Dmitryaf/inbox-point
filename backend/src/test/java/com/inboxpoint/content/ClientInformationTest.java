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
    void recognisesAButtonRemovedFromThePreviousMenuEvenAfterRestart() throws Exception {
        var database = directory.resolve("stale-menu.sqlite").toString();
        var info = new ClientInformation(database);
        info.save(JsonMapper.shared().createObjectNode().put("schedule", "Monday"));
        info.save(JsonMapper.shared().createObjectNode().put("address", "First"));
        info.save(JsonMapper.shared().createObjectNode().put("address", "Second"));
        var restored = new ClientInformation(database);
        assertThat(restored.isStaleMenuAction("Расписание")).isTrue();
        assertThat(restored.isStaleMenuAction("Адрес")).isFalse();
        assertThat(restored.isStaleMenuAction("Other customer question")).isFalse();
    }

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
    void recordsOnlyChangedSectionsInTheCurrentDocument() throws Exception {
        var database = directory.resolve("history.sqlite").toString();
        java.nio.file.Files.writeString(directory.resolve("content-settings.json"),
                JsonMapper.shared().createObjectNode().set("content", JsonMapper.shared().createObjectNode().put("prices", "150"))
                        .set("history", JsonMapper.shared().createArrayNode()).toString());
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
        assertThat(restored.resolve("Адрес")).contains("First");
        assertThat(restored.history()).extracting(ClientInformation.Change::revision).containsExactly(3, 2, 1);
    }

    @Test
    void hidesSectionsWithoutLosingSavedAnswersAndPreservesThatChoice() throws Exception {
        var database = directory.resolve("visibility.sqlite").toString();
        var info = new ClientInformation(database);
        var input = JsonMapper.shared().createObjectNode().put("prices", "150").put("schedule", "Saturday");
        info.save(input);
        assertThat(info.informationButtons()).containsExactly("Расписание", "Цены");
        input.putArray("visibleSections").add("schedule");
        info.save(input);
        var restored = new ClientInformation(database);
        assertThat(restored.informationButtons()).containsExactly("Расписание");
        assertThat(restored.current()).containsEntry("prices", "150");
        assertThat(restored.history().getFirst().sections()).containsExactly("visibility");
    }

    @Test
    void staleEditorsCannotOverwriteOrRestoreAChangedDocument() throws Exception {
        var database = directory.resolve("editor-conflict.sqlite").toString();
        var info = new ClientInformation(database);
        var version = info.snapshot().version();
        var first = info.save(JsonMapper.shared().createObjectNode().put("address", "Новый адрес"), version);
        assertThat(first.version()).hasSize(64).isNotEqualTo(version);
        assertThatThrownBy(() -> info.save(JsonMapper.shared().createObjectNode().put("address", "Старая вкладка"), version))
                .isInstanceOf(ClientInformation.VersionConflict.class);
        assertThatThrownBy(() -> info.restore(1, version)).isInstanceOf(ClientInformation.VersionConflict.class);
        assertThat(new ClientInformation(database).snapshot()).isEqualTo(first);
    }

    @Test
    void publishedMenuResolvesTheSameSyntheticFixtureAsTheReactPreview() throws Exception {
        var info = new ClientInformation(directory.resolve("preview.sqlite").toString());
        var json = JsonMapper.shared();
        var content = json.createObjectNode().put("schedule", "Пн, 18:00\n- Ср, 19:00")
                .put("address", "  ул. Мира, 1  ");
        content.putArray("faq").addObject().put("answer", "Напишите нам.").put("question", "Как записаться?");
        info.save(content);
        var actual = info.informationButtons().stream().map(label -> java.util.List.of(label, info.resolve(label))).toList();
        var fixture = Path.of("..", "tests", "fixtures", "client-response-preview.json");
        var observed = json.valueToTree(actual);
        assertThat(observed).isEqualTo(json.readTree(java.nio.file.Files.readString(fixture)));
    }

    @Test
    void publishesTrimmedAnswersOnlyOnSuccessfulSaveAndRestoresThemAfterRestart() throws Exception {
        var database = directory.resolve("inbox.sqlite").toString();
        var catalog = new ClientInformation(database);
        assertThat(catalog.resolve("Расписание")).startsWith("Расписание пока не добавлено");
        assertThat(catalog.informationButtons()).isEmpty();
        var json = JsonMapper.shared();
        assertThat(catalog.save(json.createObjectNode().put("schedule", "  По субботам  ").put("prices", "")))
                .containsEntry("schedule", "По субботам").doesNotContainKey("prices");
        assertThatThrownBy(() -> catalog.save(json.createObjectNode().put("schedule", "x".repeat(4001))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(catalog.resolve("Расписание")).contains("• По субботам");
        assertThat(catalog.informationButtons()).containsExactly("Расписание");
        assertThat(new ClientInformation(database).resolve("Расписание")).contains("• По субботам");
    }
}
