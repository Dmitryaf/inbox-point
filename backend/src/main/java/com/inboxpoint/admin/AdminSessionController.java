package com.inboxpoint.admin;

import java.sql.SQLException;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
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
class AdminSessionController {
    private final AdminSessions sessions;
    private final AdminAccess access;

    AdminSessionController(AdminSessions sessions, AdminAccess access) {
        this.sessions = sessions;
        this.access = access;
    }

    @GetMapping("/session")
    @AdminAccess.AvailableWithoutSession(reportAuthentication = true)
    Map<String, Object> session(HttpServletRequest request) {
        var context = AdminAccess.context(request);
        return view(context.authenticated(), context.bypass());
    }

    @PostMapping("/login")
    @AdminAccess.AvailableWithoutSession
    ResponseEntity<?> login(HttpServletRequest request, @RequestBody(required = false) JsonNode body) {
        var context = AdminAccess.context(request);
        if (context.bypass()) {
            return ResponseEntity.ok(view(true, true));
        }
        var password = body == null ? "" : body.path("password").asString("");
        if (body == null || !body.path("password").isString() || password.isEmpty() || password.length() > 200
                || (body.has("rememberDevice") && !body.path("rememberDevice").isBoolean())) {
            return invalidPassword();
        }
        try {
            var remember = body.has("rememberDevice") && body.path("rememberDevice").booleanValue();
            var result = sessions.login(password, context.client(), remember, context.token());
            if (result.authenticated()) {
                return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, access.cookie(result.token(), result.seconds()))
                        .body(view(true, false));
            }
            return result.seconds() == 0 ? invalidPassword() : ResponseEntity.status(429)
                    .header(HttpHeaders.RETRY_AFTER, Long.toString(result.seconds()))
                    .body(Map.of("message", "Слишком много попыток. Попробуйте позже."));
        } catch (SQLException unavailable) {
            return unavailable();
        }
    }

    @PostMapping("/logout")
    @AdminAccess.AvailableWithoutSession
    ResponseEntity<?> logout(HttpServletRequest request) {
        var context = AdminAccess.context(request);
        try {
            sessions.logout(context.token());
            return clearCookie(context.bypass());
        } catch (SQLException unavailable) {
            return unavailable();
        }
    }

    @PostMapping("/sessions/revoke-all")
    ResponseEntity<?> revokeAll(HttpServletRequest request) {
        if (AdminAccess.context(request).bypass()) {
            return ResponseEntity.ok(view(true, true));
        }
        try {
            sessions.revokeAll();
            return clearCookie(false);
        } catch (SQLException unavailable) {
            return unavailable();
        }
    }

    private ResponseEntity<?> clearCookie(boolean bypass) {
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, access.cookie("", 0)).body(view(bypass, bypass));
    }

    private static ResponseEntity<?> invalidPassword() {
        return ResponseEntity.status(401).body(Map.of("message", "Неверный пароль."));
    }

    private static ResponseEntity<?> unavailable() {
        return ResponseEntity.status(503).body(Map.of("message", "Не удалось изменить сессию. Попробуйте позже."));
    }

    private static Map<String, Object> view(boolean authenticated, boolean bypass) {
        return Map.of("authenticated", authenticated, "mode", bypass ? "bypass" : "password");
    }
}
