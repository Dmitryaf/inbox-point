package com.inboxpoint.operations;

import java.sql.SQLException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import com.inboxpoint.handoff.ClientMessages;
import com.inboxpoint.persistence.SqliteOperations;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

@RestController
@RequestMapping("/api/ops")
class IncidentController {
    private final SqliteOperations repository;
    private final ChannelRuntime runtime;

    IncidentController(SqliteOperations repository, ChannelRuntime runtime) {
        this.repository = repository;
        this.runtime = runtime;
    }

    @PostMapping("/deliveries/{id}/retry")
    ResponseEntity<?> retry(@PathVariable String id) {
        if (id.length() > 100) {
            return error(404, "Ответ не найден.");
        }
        try (var store = repository.openHandoff()) {
            return store.retryFailedDelivery(id, Instant.now()) ? ResponseEntity.ok(Map.of("queued", true))
                    : error(409, "Ответ уже отправляется, больше не требует повтора или нуждается в ручной проверке.");
        } catch (SQLException failure) {
            return error(503, "Управление доставкой пока недоступно.");
        }
    }

    @PostMapping("/deliveries/{id}/resolve")
    ResponseEntity<?> delivery(@PathVariable String id, @RequestBody(required = false) JsonNode body) {
        var resolution = field(body, "resolution");
        if (id.length() > 100 || !Set.of("received", "not_received").contains(resolution)) {
            return error(400, "Не удалось уточнить доставку.");
        }
        var queued = "not_received".equals(resolution);
        try (var store = repository.openHandoff()) {
            var now = Instant.now();
            var changed = queued ? store.confirmDeliveryNotReceived(id, now) : store.confirmDeliveryReceived(id, now);
            return changed ? ResponseEntity.ok(Map.of("queued", queued, "resolved", true))
                    : error(409, "Ответ уже обработан или не требует ручной проверки.");
        } catch (SQLException failure) {
            return error(503, "Управление доставкой пока недоступно.");
        }
    }

    @PostMapping("/inbound-events/{id}/resolve")
    ResponseEntity<?> inbound(@PathVariable String id, @RequestBody(required = false) JsonNode body) {
        var resolution = field(body, "resolution");
        var source = field(body, "source");
        if (id.length() > 500 || !Set.of("retry", "skip").contains(resolution)
                || !Set.of("telegram:get-updates", "vk:long-poll").contains(source)) {
            return error(400, "Не удалось обработать входящее событие.");
        }
        try (var store = repository.openHandoff()) {
            return resolved(store.resolveInboundEvent(source, id, "retry".equals(resolution)), "Инцидент уже обработан.");
        } catch (SQLException failure) {
            return error(503, "Управление входящими событиями недоступно.");
        }
    }

    @PostMapping("/operator-actions/{id}/resolve")
    ResponseEntity<?> operator(@PathVariable String id, @RequestBody(required = false) JsonNode body) {
        var resolution = field(body, "resolution");
        if (id.length() > 500 || !Set.of("completed", "not_completed", "received", "retry", "use_web").contains(resolution)) {
            return error(400, "Не удалось уточнить передачу обращения.");
        }
        try {
            var changed = "retry".equals(resolution) ? runtime.retryHeldOperatorReply(id) : resolveOperator(id, resolution);
            return resolved(changed, "Инцидент уже обработан или выбранное действие недоступно.");
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return error(503, "Управление передачей обращений недоступно.");
        } catch (Exception failure) {
            return error(503, "Управление передачей обращений недоступно.");
        }
    }

    private boolean resolveOperator(String id, String resolution) throws SQLException {
        try (var store = repository.openHandoff()) {
            var now = Instant.now();
            return switch (resolution) {
                case "received" -> store.confirmOperatorRelayReceived(id, ClientMessages.HANDOFF_SENT, now);
                case "completed" -> store.resolveTopicAction(id, true, now);
                case "not_completed" -> store.resolveTopicAction(id, false, now);
                case "use_web" -> store.moveOperatorIncidentToWeb(id, ClientMessages.HANDOFF_DELAYED, now);
                default -> throw new IllegalArgumentException("Unexpected resolution");
            };
        }
    }

    private static String field(JsonNode body, String key) {
        return body == null || !body.path(key).isString() ? "" : body.path(key).asString();
    }

    private static ResponseEntity<?> resolved(boolean changed, String failure) {
        return changed ? ResponseEntity.ok(Map.of("resolved", true)) : error(409, failure);
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }
}
