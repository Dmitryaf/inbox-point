package com.inboxpoint.operations;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class HealthController {
    private final ChannelRuntime runtime;

    HealthController(ChannelRuntime runtime) {
        this.runtime = runtime;
    }

    @GetMapping("/health")
    Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @GetMapping("/ready")
    ResponseEntity<Map<String, String>> ready() {
        return runtime.ready() ? ResponseEntity.ok(Map.of("status", "ready"))
                : ResponseEntity.status(503).body(Map.of("status", "not_ready"));
    }
}
