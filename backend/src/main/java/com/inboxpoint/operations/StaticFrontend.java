package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import com.inboxpoint.content.ContentAdmin;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
final class StaticFrontend {
    private static final Map<String, Asset> ASSETS = Map.of(
            "/", new Asset("index.html", "text/html;charset=UTF-8"),
            "/setup", new Asset("index.html", "text/html;charset=UTF-8"),
            "/setup/app.js", new Asset("app.js", "text/javascript;charset=UTF-8"),
            "/manage", new Asset("index.html", "text/html;charset=UTF-8"),
            "/manage/app.js", new Asset("app.js", "text/javascript;charset=UTF-8"),
            "/manage/style.css", new Asset("style.css", "text/css;charset=UTF-8"),
            "/app.js", new Asset("app.js", "text/javascript;charset=UTF-8"),
            "/style.css", new Asset("style.css", "text/css;charset=UTF-8"));

    private final Path frontend;
    private final ContentAdmin admin;

    StaticFrontend(@Value("${inboxpoint.frontend.path:dist/frontend}") String directory, ContentAdmin admin) {
        this.admin = admin;
        frontend = Path.of(directory);
    }

    @GetMapping({"/", "/app.js", "/style.css", "/setup", "/setup/app.js", "/manage", "/manage/app.js", "/manage/style.css"})
    ResponseEntity<byte[]> serve(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var route = request.getRequestURI();
        if (route.startsWith("/manage")) {
            if (!admin.available(request, response)) {
                return ResponseEntity.notFound().build();
            }
            response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; "
                    + "connect-src 'self'; frame-ancestors 'none'; form-action 'self'");
        }
        if (route.startsWith("/setup")) {
            if (!LocalSetupAccess.allow(request, response)) {
                return ResponseEntity.notFound().build();
            }
            response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; "
                    + "connect-src 'self'; frame-ancestors 'none'");
        }
        var asset = ASSETS.get(route);
        var file = frontend.resolve(asset.file());
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.contentType()))
                .body(Files.readAllBytes(file));
    }

    private record Asset(String file, String contentType) { }
}
