package com.inboxpoint.operations;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ops/service-control")
class ServiceControlController {
    private static final Set<String> TARGETS = Set.of("telegram", "vk", "delivery");
    private final LocalServiceControl control;

    ServiceControlController(ChannelRuntime runtime) {
        control = runtime.control();
    }

    @GetMapping
    ResponseEntity<?> status() {
        try {
            return ResponseEntity.ok(control.state());
        } catch (IOException failure) {
            return error(500, "Не удалось загрузить состояние службы.");
        }
    }

    @PostMapping("/{target}/pause")
    ResponseEntity<?> pause(@PathVariable String target) {
        return change(target, true, "Не удалось приостановить новые обращения.", "Не удалось остановить исходящую доставку.");
    }

    @PostMapping("/{target}/resume")
    ResponseEntity<?> resume(@PathVariable String target) {
        return change(target, false, "Не удалось возобновить новые обращения.", "Не удалось возобновить исходящую доставку.");
    }

    private ResponseEntity<?> change(String target, boolean paused, String intakeError, String deliveryError) {
        if (!TARGETS.contains(target)) {
            return error(404, "Канал не найден.");
        }
        try {
            return ResponseEntity.ok(control.setMode(target, paused, Instant.now()));
        } catch (IOException failure) {
            return error(500, "delivery".equals(target) ? deliveryError : intakeError);
        }
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }
}
