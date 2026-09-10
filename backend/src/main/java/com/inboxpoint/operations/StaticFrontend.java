package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
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
    private static final Map<String, Asset> ASSETS = Map.ofEntries(
            Map.entry("/setup/favicon.svg", new Asset("favicon.svg", "image/svg+xml;charset=UTF-8")),
            Map.entry("/manage/favicon.svg", new Asset("favicon.svg", "image/svg+xml;charset=UTF-8")),
            Map.entry("/ops/favicon.svg", new Asset("favicon.svg", "image/svg+xml;charset=UTF-8")),
            Map.entry("/setup", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/setup/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/manage", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/manage/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/manage/style.css", new Asset("style.css", "text/css;charset=UTF-8")),
            Map.entry("/ops", new Asset("index.html", "text/html;charset=UTF-8")),
            Map.entry("/ops/app.js", new Asset("app.js", "text/javascript;charset=UTF-8")),
            Map.entry("/ops/style.css", new Asset("style.css", "text/css;charset=UTF-8")),
            Map.entry("/setup/style.css", new Asset("style.css", "text/css;charset=UTF-8")));

    private final Path frontend;
    private final AdminSessions admin;

    StaticFrontend(@Value("${inboxpoint.frontend.path:dist/frontend}") String directory, AdminSessions admin) {
        this.admin = admin;
        frontend = Path.of(directory);
    }

    @GetMapping({"/setup", "/setup/app.js", "/setup/style.css", "/manage", "/manage/app.js", "/manage/style.css", "/ops", "/ops/app.js", "/ops/style.css", "/setup/favicon.svg", "/manage/favicon.svg", "/ops/favicon.svg"})
    ResponseEntity<byte[]> serve(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var route = request.getRequestURI();
        var operations = route.startsWith("/ops");
        var content = route.startsWith("/manage");
        if (operations || content || route.startsWith("/setup")) {
            if (!admin.available(request, response)) {
                return ResponseEntity.notFound().build();
            }
            response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; "
                    + "connect-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'");
        }
        var asset = ASSETS.get(route);
        var file = frontend.resolve(asset.file());
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        byte[] body = Files.readAllBytes(file);
        if ("index.html".equals(asset.file())) {
            var prefix = operations ? "/ops/" : content ? "/manage/" : "/setup/";
            body = new String(body, StandardCharsets.UTF_8).replace("=\"./", "=\"" + prefix)
                    .getBytes(StandardCharsets.UTF_8);
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(asset.contentType())).body(body);
    }

    private record Asset(String file, String contentType) { }
}
