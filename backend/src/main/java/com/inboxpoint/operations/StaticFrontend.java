package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
final class StaticFrontend {
    private static final Map<String, Asset> ASSETS = Map.of(
            "/", new Asset("index.html", "text/html;charset=UTF-8"),
            "/app.js", new Asset("app.js", "text/javascript;charset=UTF-8"),
            "/style.css", new Asset("style.css", "text/css;charset=UTF-8"));

    private final Path frontend;

    StaticFrontend(@Value("${inboxpoint.frontend.path:dist/frontend}") String directory) {
        frontend = Path.of(directory);
    }

    @GetMapping({"/", "/app.js", "/style.css"})
    ResponseEntity<byte[]> serve(HttpServletRequest request) throws IOException {
        var asset = ASSETS.get(request.getRequestURI());
        var file = frontend.resolve(asset.file());
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.contentType()))
                .body(Files.readAllBytes(file));
    }

    private record Asset(String file, String contentType) { }
}
