package com.inboxpoint.operations;

import java.sql.SQLException;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

import com.inboxpoint.persistence.SqliteOperatorInbox;
import com.inboxpoint.persistence.SqliteOperatorInbox.MessageCursor;
import com.inboxpoint.persistence.SqliteOperatorInbox.Page;
import com.inboxpoint.persistence.SqliteOperatorInbox.RequestCursor;
import com.inboxpoint.persistence.SqliteTextHandoff.WebActionResult;
import org.springframework.http.ResponseEntity;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/ops/inbox/requests")
class OperatorInboxController {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final Pattern CURSOR = Pattern.compile("[A-Za-z0-9_-]{1,512}");
    private static final Pattern ACTION_KEY = Pattern.compile("[A-Za-z0-9_-]{1,100}");
    private static final Pattern UTC_DATE = Pattern.compile("\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d(?::\\d\\d(?:\\.\\d+)?)?Z");
    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    private final SqliteOperatorInbox inbox;

    OperatorInboxController(SqliteOperatorInbox inbox) {
        this.inbox = inbox;
    }

    @GetMapping
    ResponseEntity<?> requests(@RequestParam MultiValueMap<String, String> query) {
        try {
            var json = cursor(query, "id");
            RequestCursor before = null;
            if (json != null) {
                var id = readString(json, "id");
                if (!validId(id)) {
                    throw new IllegalArgumentException();
                }
                before = new RequestCursor(cursorDate(json), id);
            }
            return ResponseEntity.ok(view("requests", inbox.requests(before)));
        } catch (IllegalArgumentException | DateTimeException | JacksonException invalid) {
            return error(400, "Не удалось открыть следующую страницу. Обновите список.");
        } catch (SQLException failure) {
            return failed();
        }
    }

    @GetMapping("/{requestId}/messages")
    ResponseEntity<?> messages(@PathVariable String requestId, @RequestParam MultiValueMap<String, String> query) {
        if (!validId(requestId)) {
            return notFound();
        }
        try {
            var json = cursor(query, "rowId");
            MessageCursor before = null;
            if (json != null) {
                var row = json.path("rowId");
                var value = row.longValue();
                if (!row.isNumber() || !row.canConvertToExactIntegral() || !row.canConvertToLong()
                        || value <= 0 || value >= (1L << 53)) {
                    throw new IllegalArgumentException();
                }
                before = new MessageCursor(cursorDate(json), value);
            }
            var page = inbox.messages(requestId, before);
            return page.isEmpty() ? notFound() : ResponseEntity.ok(view("messages", page.get()));
        } catch (IllegalArgumentException | DateTimeException | JacksonException invalid) {
            return error(400, "Не удалось открыть предыдущие сообщения. Обновите переписку.");
        } catch (SQLException failure) {
            return failed();
        }
    }

    @PostMapping("/{requestId}/replies")
    ResponseEntity<?> reply(@PathVariable String requestId, @RequestBody(required = false) JsonNode body) {
        var key = readString(body, "idempotencyKey");
        var text = readString(body, "text").replaceAll("(?U)^[\\s\\uFEFF]+|[\\s\\uFEFF]+$", "");
        if (!validId(requestId) || !ACTION_KEY.matcher(key).matches() || text.isEmpty() || text.length() > 4_000) {
            return error(400, "Введите ответ длиной до 4000 символов.");
        }
        try {
            return result(inbox.reply(requestId, key, text, Instant.now()), "queued");
        } catch (SQLException failure) {
            return failed();
        }
    }

    @PostMapping("/{requestId}/close")
    ResponseEntity<?> close(@PathVariable String requestId, @RequestBody(required = false) JsonNode body) {
        var key = readString(body, "idempotencyKey");
        if (!validId(requestId) || !ACTION_KEY.matcher(key).matches()) {
            return error(400, "Не удалось закрыть обращение.");
        }
        try {
            return result(inbox.close(requestId, key, Instant.now()), "closed");
        } catch (SQLException failure) {
            return failed();
        }
    }

    private static Map<String, Object> view(String items, Page<?, ?> page) {
        var result = new LinkedHashMap<String, Object>();
        result.put(items, page.items());
        if (page.next() != null) {
            result.put("nextCursor", Base64.getUrlEncoder().withoutPadding().encodeToString(JSON.writeValueAsBytes(page.next())));
        }
        return result;
    }

    private static JsonNode cursor(MultiValueMap<String, String> query, String key) {
        if (query.isEmpty()) {
            return null;
        }
        var values = query.get("cursor");
        if (query.size() != 1 || values == null || values.size() != 1 || !CURSOR.matcher(values.getFirst()).matches()) {
            throw new IllegalArgumentException();
        }
        var value = JSON.readTree(Base64.getUrlDecoder().decode(values.getFirst()));
        if (!value.isObject() || value.size() != 2 || !value.has("createdAt") || !value.has(key)) {
            throw new IllegalArgumentException();
        }
        return value;
    }

    private static String cursorDate(JsonNode value) {
        var date = readString(value, "createdAt");
        if (!UTC_DATE.matcher(date).matches()) {
            throw new IllegalArgumentException();
        }
        return TIMESTAMP.format(Instant.parse(date.length() == 17 ? date.substring(0, 16) + ":00Z" : date));
    }

    private static String readString(JsonNode body, String field) {
        return body != null && body.path(field).isString() ? body.path(field).asString() : "";
    }

    private static boolean validId(String id) {
        return !id.isEmpty() && id.length() <= 100;
    }

    private static ResponseEntity<?> result(WebActionResult result, String field) {
        return switch (result) {
            case ACCEPTED -> ResponseEntity.ok(Map.of(field, true));
            case NOT_FOUND -> notFound();
            case CLOSED -> error(409, "Обращение уже закрыто.");
        };
    }

    private static ResponseEntity<Map<String, String>> notFound() {
        return error(404, "Обращение не найдено.");
    }

    private static ResponseEntity<Map<String, String>> failed() {
        return error(500, "Не удалось выполнить действие. Попробуйте ещё раз.");
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("message", message));
    }
}
