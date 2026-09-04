package com.inboxpoint.operations;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {
    private final OperationsController operations;

    HealthController(OperationsController operations) {
        this.operations = operations;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/ready")
    ResponseEntity<Map<String, Object>> ready() {
        try {
            if (operations.isReady()) {
                return ResponseEntity.ok(Map.of("status", "ready"));
            }
            return ResponseEntity.status(503).body(Map.of("status", "not_ready"));
        } catch (IOException | SQLException unavailable) {
            return ResponseEntity.status(503).body(Map.of("status", "not_ready"));
        }
    }
}
