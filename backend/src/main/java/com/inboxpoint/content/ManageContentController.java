package com.inboxpoint.content;

import java.io.IOException;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
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
    private final ContentAdmin admin;
    private final ClientInformation information;

    ManageContentController(ContentAdmin admin, ClientInformation information) {
        this.admin = admin;
        this.information = information;
    }

    @GetMapping("/session")
    ResponseEntity<?> session(HttpServletRequest request, HttpServletResponse response) {
        return admin.available(request, response)
                ? ResponseEntity.ok(Map.of("authenticated", admin.authorized(request, response))) : missing();
    }

    @PostMapping("/login")
    ResponseEntity<?> login(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        if (!ContentAdmin.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        var result = admin.login(input.path("password").asString(""), request.getRemoteAddr());
        if (result.retryAfter() > 0) {
            return ResponseEntity.status(429).header(HttpHeaders.RETRY_AFTER, Long.toString(result.retryAfter()))
                    .body(Map.of("message", "Слишком много попыток. Попробуйте позже."));
        }
        if (result.token() == null) {
            return error(401, "Неверный пароль.");
        }
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, admin.cookie(result.token(), true))
                .body(Map.of("authenticated", true));
    }

    @PostMapping("/logout")
    ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        if (!ContentAdmin.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        admin.logout(request);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, admin.cookie("", false))
                .body(Map.of("authenticated", false));
    }

    @GetMapping("/content")
    ResponseEntity<?> content(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return missing();
        }
        return admin.authorized(request, response) ? ResponseEntity.ok(information.current()) : unauthorized();
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
        if (!ContentAdmin.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        try {
            return ResponseEntity.ok(information.save(input));
        } catch (IllegalArgumentException invalid) {
            return error(400, "Проверьте названия и тексты кнопок. В FAQ после каждого вопроса должен быть ответ.");
        } catch (IOException unavailable) {
            return error(500, "Не удалось сохранить информацию. Попробуйте ещё раз.");
        }
    }

    private static ResponseEntity<Map<String, String>> missing() {
        return error(404, "Not found");
    }

    private static ResponseEntity<Map<String, String>> unauthorized() {
        return error(401, "Введите пароль управления.");
    }

    private static ResponseEntity<Map<String, String>> error(int code, String message) {
        return ResponseEntity.status(code).body(Map.of("message", message));
    }
}
