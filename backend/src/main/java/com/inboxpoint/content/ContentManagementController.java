package com.inboxpoint.content;

import java.io.IOException;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/manage/content")
class ContentManagementController {
    private static final Pattern VERSION = Pattern.compile("[a-f0-9]{64}");
    private static final String INVALID_FIELDS = "Проверьте заполненные поля и ограничения по длине.";
    private static final String INVALID_VERSION = "Версия указана неверно.";
    private final ContentEditor editor;

    ContentManagementController(ContentEditor editor) {
        this.editor = editor;
    }

    @GetMapping
    ContentEditor.Snapshot current() {
        return editor.current();
    }

    @GetMapping("/history")
    ResponseEntity<?> history() {
        try {
            return ResponseEntity.ok(Map.of("history", editor.history()));
        } catch (IOException failure) {
            return error(500, "Не удалось загрузить историю изменений. Попробуйте ещё раз.");
        }
    }

    @GetMapping("/history/{revision}")
    ResponseEntity<?> revision(@PathVariable("revision") String revision) {
        long number;
        try {
            number = Long.parseLong(revision);
        } catch (NumberFormatException invalid) {
            return error(400, INVALID_VERSION);
        }
        if (number <= 0 || number >= (1L << 53)) {
            return error(400, INVALID_VERSION);
        }
        try {
            var snapshot = editor.revision(number);
            return snapshot.isPresent() ? ResponseEntity.ok(snapshot.get()) : error(404, "Эта версия больше недоступна.");
        } catch (IOException failure) {
            return error(500, "Не удалось загрузить версию. Попробуйте ещё раз.");
        }
    }

    @PostMapping
    ResponseEntity<?> save(@RequestBody(required = false) JsonNode request) {
        try {
            ContentShape.object(request, true, "content", "version");
            var version = version(request.path("version"));
            return ResponseEntity.ok(editor.save(request.path("content"), version));
        } catch (ContentShape.InvalidContent invalid) {
            return error(400, INVALID_FIELDS);
        } catch (ContentFields.LegacyScheduleEdit outdated) {
            return error(409, "Расписание теперь редактируется в разделе «Занятия». Обновите страницу перед сохранением.");
        } catch (ContentEditor.VersionConflict stale) {
            return error(409, "Информация уже изменилась в другой вкладке. Скопируйте свои правки, затем обновите страницу и внесите их повторно.");
        } catch (IOException failure) {
            return error(500, "Не удалось сохранить информацию. Попробуйте ещё раз.");
        }
    }

    @PostMapping("/restore")
    ResponseEntity<?> restore(@RequestBody(required = false) JsonNode request) {
        try {
            ContentShape.object(request, true, "revision", "version");
            var number = ContentSettingsFile.positiveNumber(request.path("revision"));
            var version = version(request.path("version"));
            return ResponseEntity.ok(editor.restore(number, version));
        } catch (ContentShape.InvalidContent invalid) {
            return error(400, INVALID_VERSION);
        } catch (ContentEditor.RevisionUnavailable unavailable) {
            return error(404, "Эта версия больше недоступна для восстановления.");
        } catch (ContentEditor.VersionConflict stale) {
            return error(409, "Информация уже изменилась в другой вкладке. Обновите страницу перед восстановлением версии.");
        } catch (IOException failure) {
            return error(500, "Не удалось восстановить информацию. Попробуйте ещё раз.");
        }
    }

    private static String version(JsonNode node) {
        var value = ContentShape.text(node, 64, 64, false);
        ContentShape.require(VERSION.matcher(value).matches());
        return value;
    }

    private static ResponseEntity<Map<String, String>> error(int status, String description) {
        return ResponseEntity.status(status).body(Map.of("message", description));
    }
}
