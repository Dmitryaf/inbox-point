package com.inboxpoint.admin;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class FrontendController {
    private static final String POLICY = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; "
            + "img-src 'self'; frame-ancestors 'none'; form-action 'self'";
    private static final Map<String, String> ASSETS = Map.of(
            "/favicon.svg", "image/svg+xml;charset=UTF-8",
            "/inbox-point-social-preview.png", "image/png",
            "/app.js", "application/javascript;charset=UTF-8",
            "/style.css", "text/css;charset=UTF-8");
    private final AdminAccess access;
    private final Path frontend;

    FrontendController(AdminAccess access, @Value("${inboxpoint.frontend.path:dist/frontend}") String frontend) {
        this.access = access;
        this.frontend = Path.of(frontend);
    }

    @GetMapping("/{*route}")
    @AdminAccess.AvailableWithoutSession
    ResponseEntity<?> serve(@PathVariable String route, HttpServletRequest request, HttpServletResponse response) {
        AdminAccess.privateResponse(response);
        var origin = access.frontendOrigin(request);
        if (origin == null || route.equals("/api") || route.startsWith("/api/")) {
            return notFound();
        }
        var type = ASSETS.get(route);
        try {
            if (type != null) {
                return ResponseEntity.ok().contentType(MediaType.parseMediaType(type))
                        .body(Files.readAllBytes(frontend.resolve(route.substring(1))));
            }
            var html = Files.readString(frontend.resolve("index.html"));
            response.setHeader("Content-Security-Policy", POLICY);
            return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/html;charset=UTF-8"))
                    .body(html.replace("__INBOX_POINT_ORIGIN__", origin));
        } catch (NoSuchFileException missing) {
            return type == null ? unavailable() : notFound();
        } catch (IOException unreadable) {
            return unavailable();
        }
    }

    private static ResponseEntity<Map<String, String>> notFound() {
        return ResponseEntity.status(404).contentType(MediaType.APPLICATION_JSON).body(Map.of("message", "Not found"));
    }

    private static ResponseEntity<Map<String, String>> unavailable() {
        return ResponseEntity.status(503).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("message", "Не удалось загрузить интерфейс. Попробуйте позже."));
    }
}
