package com.inboxpoint.admin;

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
@RequestMapping("/api/admin")
final class AdminSessionController {
    private final AdminSessions admin;

    AdminSessionController(AdminSessions admin) {
        this.admin = admin;
    }

    @GetMapping("/session")
    ResponseEntity<?> session(HttpServletRequest request, HttpServletResponse response) {
        return admin.available(request, response)
                ? ResponseEntity.ok(Map.of("authenticated", admin.authorized(request, response), "mode", mode(request, response)))
                : error(404, "Not found");
    }

    @PostMapping("/login")
    ResponseEntity<?> login(@RequestBody(required = false) JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return error(404, "Not found");
        }
        if (!admin.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        if (admin.authorized(request, response)) {
            return ResponseEntity.ok(Map.of("authenticated", true, "mode", mode(request, response)));
        }
        var password = input == null ? "" : input.path("password").asString("");
        if (password.isEmpty() || password.length() > 200) {
            return error(401, "Неверный пароль.");
        }
        var result = admin.login(password, admin.clientAddress(request));
        if (result.retryAfter() > 0) {
            return ResponseEntity.status(429).header(HttpHeaders.RETRY_AFTER, Long.toString(result.retryAfter()))
                    .body(Map.of("message", "Слишком много попыток. Попробуйте позже."));
        }
        if (result.token() == null) {
            return error(401, "Неверный пароль.");
        }
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, admin.cookie(result.token(), true))
                .body(Map.of("authenticated", true, "mode", "password"));
    }

    @PostMapping("/logout")
    ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response) {
        if (!admin.available(request, response)) {
            return error(404, "Not found");
        }
        if (!admin.sameOrigin(request)) {
            return error(403, "Запрос отклонён.");
        }
        admin.logout(request);
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, admin.cookie("", false))
                .body(Map.of("authenticated", admin.local(request, response), "mode", mode(request, response)));
    }

    private String mode(HttpServletRequest request, HttpServletResponse response) {
        return admin.local(request, response) ? "bypass" : "password";
    }

    private static ResponseEntity<Map<String, String>> error(int status, String text) {
        return ResponseEntity.status(status).body(Map.of("message", text));
    }
}
