package com.inboxpoint.operations;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

import com.inboxpoint.telegram.TelegramRuntime;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {
    private final TelegramRuntime telegram;

    HealthController(TelegramRuntime telegram) {
        this.telegram = telegram;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/ready")
    ResponseEntity<Map<String, Object>> ready() {
        try {
            return ResponseEntity.ok(Map.of("status", "ready", "deliveries", telegram.deliveryCounts()));
        } catch (IOException | SQLException unavailable) {
            return ResponseEntity.status(503).body(Map.of("status", "not_ready"));
        }
    }
}
