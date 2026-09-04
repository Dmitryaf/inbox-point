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
    private static final Map<String, Asset> ASSETS = Map.ofEntries(
            Map.entry("/", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/setup", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/setup/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/manage", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/manage/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/manage/style.css", new Asset("style.css", "text/css;charset=UTF-8")),
            Map.entry("/ops", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/ops/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/ops/style.css", new Asset("style.css", "text/css;charset=UTF-8")),
            Map.entry("/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/style.css", new Asset("style.css", "text/css;charset=UTF-8")));

    private final Path frontend;
    private final ContentAdmin admin;
    private final OperationsAdmin ops;

    StaticFrontend(@Value("${inboxpoint.frontend.path:dist/frontend}") String directory, ContentAdmin admin, OperationsAdmin ops) {
        this.ops = ops;
        this.admin = admin;
        frontend = Path.of(directory);
    }

    @GetMapping({"/", "/app.js", "/style.css", "/setup", "/setup/app.js", "/manage", "/manage/app.js", "/manage/style.css", "/ops", "/ops/app.js", "/ops/style.css"})
    ResponseEntity<byte[]> serve(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var route = request.getRequestURI();
        var operations = route.startsWith("/ops");
        var content = route.startsWith("/manage");
        if (operations || content) {
            if (!(operations ? ops : admin).available(request, response)) {
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
        var root = operations ? frontend.resolveSibling("ops") : content ? frontend.resolveSibling("manage") : frontend;
        var file = root.resolve(asset.file());
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.contentType()))
                .body(Files.readAllBytes(file));
    }

    private record Asset(String file, String contentType) { }
}
