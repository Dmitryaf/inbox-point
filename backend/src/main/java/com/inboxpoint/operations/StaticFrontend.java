package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import com.inboxpoint.admin.AdminSessions;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
final class StaticFrontend {
    private static final Asset PAGE = new Asset("index.html", "text/html;charset=UTF-8");
    private static final Map<String, Asset> ASSETS = Map.of(
            "/app.js", new Asset("app.js", "text/javascript;charset=UTF-8"),
            "/style.css", new Asset("style.css", "text/css;charset=UTF-8"),
            "/inbox-point-social-preview.png", new Asset("inbox-point-social-preview.png", "image/png"),
            "/favicon.svg", new Asset("favicon.svg", "image/svg+xml;charset=UTF-8"));
    private final Path frontend;
    private final AdminSessions admin;

    StaticFrontend(@Value("${inboxpoint.frontend.path:dist/frontend}") String directory, AdminSessions admin) {
        frontend = Path.of(directory);
        this.admin = admin;
    }

    @GetMapping({"/", "/{*route}"})
    ResponseEntity<?> serve(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var path = request.getRequestURI();
        if (!admin.available(request, response)) {
            return ResponseEntity.notFound().build();
        }
        if (path.equals("/api") || path.startsWith("/api/")) {
            return ResponseEntity.status(404).body(Map.of("message", "Not found"));
        }
        var asset = ASSETS.getOrDefault(path, PAGE);
        if (asset == PAGE) {
            response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; "
                    + "connect-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'");
        }
        var file = frontend.resolve(asset.file());
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        var bytes = asset == PAGE
                ? Files.readString(file).replace("__INBOX_POINT_ORIGIN__", org.springframework.web.util.HtmlUtils.htmlEscape(admin.baseUrl(request)))
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8)
                : Files.readAllBytes(file);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.contentType())).body(bytes);
    }

    private record Asset(String file, String contentType) { }
}
