package com.inboxpoint.persistence;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Objects;

public final class LegacySqlite {
    private LegacySqlite() {
    }

    public static Path createVersion17(Path directory) throws IOException, SQLException {
        String schema;
        try (var input = Objects.requireNonNull(LegacySqlite.class.getResourceAsStream("/legacy-sqlite-v17.sql"))) {
            schema = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        var path = directory.resolve("inbox-point.sqlite");
        try (var connection = connect(path);
                var statement = connection.createStatement()) {
            for (var sql : schema.split("(?m)^-- statement$")) {
                if (!sql.strip().startsWith("--")) {
                    statement.execute(sql);
                }
            }
            statement.executeUpdate("""
                    INSERT INTO support_requests
                        (id, channel, external_conversation_id, operator_topic_id, status, created_at)
                    VALUES ('request-1', 'telegram', '1234567890123', '501', 'active', '2026-11-01T10:00:00.000Z')
                    """);
        }
        return path;
    }

    public static Connection connect(Path path) throws SQLException {
        return DriverManager.getConnection("jdbc:sqlite:" + path);
    }
}
