package com.inboxpoint.content;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.inboxpoint.persistence.LocalJsonFile;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public final class ClientInformation {
    public static final String SCHEDULE = "Расписание";
    public static final String PRICES = "Цены";
    public static final String ADDRESS = "Адрес";
    public static final String ASK = "Задать вопрос преподавателю";
    public static final String RESET = "Начать новый вопрос";
    private static final String UNAVAILABLE = " пока не добавлено. Вы можете задать вопрос преподавателю.";
    private static final List<String> FIELDS = List.of("schedule", "prices", "address");
    private final Path file;
    private volatile Map<String, String> content;

    public ClientInformation(@Value("${DATABASE_PATH:./data/messenger-handoff.sqlite}") String database) {
        file = Path.of(database).toAbsolutePath().resolveSibling("content-settings.json");
        try {
            var json = JsonMapper.shared().readTree(Files.readString(file));
            if (json.path("version").asInt() != 1) {
                throw new IllegalArgumentException("Unsupported content settings version");
            }
            content = fields(json);
        } catch (NoSuchFileException missing) {
            content = Map.of();
        } catch (IOException | RuntimeException invalid) {
            LoggerFactory.getLogger(ClientInformation.class).warn("Saved client information could not be read");
            content = Map.of();
        }
    }

    public Map<String, String> current() {
        return content;
    }

    public synchronized Map<String, String> save(JsonNode input) throws IOException {
        var next = fields(input);
        var output = JsonMapper.shared().createObjectNode().put("version", 1);
        next.forEach(output::put);
        LocalJsonFile.write(file, output);
        content = next;
        return next;
    }

    public String resolve(String label) {
        var snapshot = content;
        return switch (label) {
            case SCHEDULE -> snapshot.getOrDefault("schedule", "Расписание" + UNAVAILABLE);
            case PRICES -> snapshot.getOrDefault("prices", "Информация о ценах" + UNAVAILABLE);
            case ADDRESS -> snapshot.getOrDefault("address", "Информация об адресе" + UNAVAILABLE);
            default -> null;
        };
    }

    private static Map<String, String> fields(JsonNode input) {
        if (!input.isObject()) {
            throw new IllegalArgumentException("Expected content object");
        }
        var values = new LinkedHashMap<String, String>();
        for (var field : FIELDS) {
            var item = input.path(field);
            if (item.isMissingNode()) {
                continue;
            }
            if (!item.isString() || item.asString().length() > 4000) {
                throw new IllegalArgumentException("Each section must be at most 4000 characters");
            }
            var text = item.asString().strip();
            if (!text.isEmpty()) {
                values.put(field, text);
            }
        }
        return Map.copyOf(values);
    }
}
