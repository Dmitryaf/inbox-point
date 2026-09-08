package com.inboxpoint.content;

import java.io.IOException;
import java.util.Map;

import com.inboxpoint.admin.AdminSessions;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/manage")
final class ManageContentController {
    private final AdminSessions admin;
    private final ClientInformation information;

    ManageContentController(AdminSessions admin, ClientInformation information) {
        this.admin = admin;
        this.information = information;
    }

    @GetMapping("/content")
    ResponseEntity<?> content(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        return admin.authorized(request, response) ? ResponseEntity.ok(information.snapshot()) : unauthorized();
    }

    @GetMapping("/content/history")
    ResponseEntity<?> history(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        return admin.authorized(request, response)
                ? ResponseEntity.ok(Map.of("history", information.history())) : unauthorized();
    }

    @PostMapping("/content")
    ResponseEntity<?> save(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        if (!admin.authorized(request, response)) {
            return unauthorized();
        }
        if (!AdminSessions.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        var version = input.path("version").asString("");
        if (!version.matches("[0-9a-f]{64}") || !input.path("content").isObject()) {
            return error(400, "Проверьте данные редактора.");
        }
        try {
            return ResponseEntity.ok(information.save(input.path("content"), version));
        } catch (ClientInformation.VersionConflict conflict) {
            return error(409, "Информация уже изменилась в другой вкладке. Скопируйте свои правки и обновите страницу.");
        } catch (IllegalArgumentException invalid) {
            return error(400, "Проверьте названия и тексты кнопок. В FAQ после каждого вопроса должен быть ответ.");
        } catch (IOException unavailable) {
            return error(500, "Не удалось сохранить информацию. Попробуйте ещё раз.");
        }
    }

    @PostMapping("/content/restore")
    ResponseEntity<?> restore(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        if (!admin.authorized(request, response)) {
            return unauthorized();
        }
        if (!AdminSessions.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        var revision = input.path("revision");
        var version = input.path("version").asString("");
        if (!revision.isIntegralNumber() || !revision.canConvertToInt() || revision.asInt() <= 0
                || !version.matches("[0-9a-f]{64}")) {
            return error(400, "Версия указана неверно.");
        }
        try {
            var restored = information.restore(revision.intValue(), version);
            return restored == null ? error(404, "Эта версия больше недоступна для восстановления.")
                    : ResponseEntity.ok(restored);
        } catch (ClientInformation.VersionConflict conflict) {
            return error(409, "Информация уже изменилась в другой вкладке. Обновите страницу перед восстановлением версии.");
        } catch (IOException unavailable) {
            return error(500, "Не удалось восстановить информацию. Попробуйте ещё раз.");
        }
    }

    private static ResponseEntity<Map<String, String>> missing() {
        return error(404, "Not found");
    }

    private static ResponseEntity<Map<String, String>> unauthorized() {
        return error(401, "Войдите, чтобы продолжить.");
    }

    private static ResponseEntity<Map<String, String>> error(int code, String message) {
        return ResponseEntity.status(code).body(Map.of("message", message));
    }
}
