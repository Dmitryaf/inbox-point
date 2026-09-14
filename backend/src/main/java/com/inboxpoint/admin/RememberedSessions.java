package com.inboxpoint.admin;

import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.Instant;

import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteOpenMode;

final class RememberedSessions {
    private final Path database;

    RememberedSessions(Path database) {
        this.database = database.toAbsolutePath();
    }

    void save(String hash, Instant now, Instant expires) {
        query("INSERT INTO remembered_admin_sessions(token_hash, created_at, expires_at) VALUES (?, ?, ?)", statement -> {
            statement.setString(1, hash);
            statement.setLong(2, now.toEpochMilli());
            statement.setLong(3, expires.toEpochMilli());
            return statement.executeUpdate();
        });
    }

    boolean active(String hash, Instant now) {
        return query("SELECT 1 FROM remembered_admin_sessions WHERE token_hash = ? AND expires_at > ?", statement -> {
            statement.setString(1, hash);
            statement.setLong(2, now.toEpochMilli());
            try (var rows = statement.executeQuery()) {
                return rows.next();
            }
        });
    }

    void delete(String hash) {
        query("DELETE FROM remembered_admin_sessions WHERE token_hash = ?", statement -> {
            statement.setString(1, hash);
            return statement.executeUpdate();
        });
    }

    void clear() {
        query("DELETE FROM remembered_admin_sessions", PreparedStatement::executeUpdate);
    }

    private <T> T query(String sql, Operation<T> operation) {
        var config = new SQLiteConfig();
        config.setBusyTimeout(5_000);
        config.resetOpenMode(SQLiteOpenMode.CREATE);
        try (var connection = config.createConnection("jdbc:sqlite:" + database);
                var statement = connection.prepareStatement(sql)) {
            return operation.run(statement);
        } catch (SQLException failure) {
            throw new IllegalStateException("Remembered administrator sessions are unavailable", failure);
        }
    }

    @FunctionalInterface
    private interface Operation<T> {
        T run(PreparedStatement statement) throws SQLException;
    }
}
