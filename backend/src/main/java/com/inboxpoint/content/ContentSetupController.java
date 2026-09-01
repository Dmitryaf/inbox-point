package com.inboxpoint.content;

import java.io.IOException;
import java.util.Map;

import com.inboxpoint.operations.LocalSetupAccess;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
final class ContentSetupController {
    private final ClientInformation information;

    ContentSetupController(ClientInformation information) {
        this.information = information;
    }

    @GetMapping("/api/setup/content")
    ResponseEntity<?> content(HttpServletRequest request, HttpServletResponse response) {
        return LocalSetupAccess.allow(request, response)
                ? ResponseEntity.ok(information.current()) : ResponseEntity.notFound().build();
    }

    @PostMapping("/api/setup/content")
    ResponseEntity<?> save(@RequestBody JsonNode input, HttpServletRequest request, HttpServletResponse response) {
        if (!LocalSetupAccess.allow(request, response)) {
            return ResponseEntity.notFound().build();
        }
        try {
            return ResponseEntity.ok(information.save(input));
        } catch (IllegalArgumentException invalid) {
            return ResponseEntity.badRequest().body(Map.of("message", "Каждый раздел должен быть короче 4000 символов."));
        } catch (IOException unavailable) {
            return ResponseEntity.status(503).body(Map.of("message", "Не удалось сохранить информацию."));
        }
    }
}
