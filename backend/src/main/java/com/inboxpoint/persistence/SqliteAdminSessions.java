package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.SQLException;

public final class SqliteAdminSessions {
    private final Path database;

    public SqliteAdminSessions(Path database) {
        this.database = database;
    }

    public boolean hasActive(String tokenHash, long now) throws SQLException {
        try (var connection = SqliteDatabase.openExisting(database, true);
                var query = connection.prepareStatement("""
                        SELECT 1 FROM remembered_admin_sessions WHERE token_hash = ? AND expires_at > ?
                        """)) {
            query.setString(1, tokenHash);
            query.setLong(2, now);
            try (var rows = query.executeQuery()) {
                return rows.next();
            }
        }
    }

    public void rotate(String previous, String next, long now, long expiresAt) throws SQLException {
        if (previous == null && next == null) {
            return;
        }
        try (var connection = SqliteDatabase.openExisting(database, false)) {
            SqliteDatabase.writeTransaction(connection, () -> {
                if (previous != null) {
                    try (var delete = connection.prepareStatement("DELETE FROM remembered_admin_sessions WHERE token_hash = ?")) {
                        delete.setString(1, previous);
                        delete.executeUpdate();
                    }
                }
                if (next != null) {
                    try (var insert = connection.prepareStatement("""
                            INSERT INTO remembered_admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)
                            """)) {
                        insert.setString(1, next);
                        insert.setLong(2, now);
                        insert.setLong(3, expiresAt);
                        insert.executeUpdate();
                    }
                }
            });
        }
    }

    public void revokeAll() throws SQLException {
        try (var connection = SqliteDatabase.openExisting(database, false); var statement = connection.createStatement()) {
            statement.executeUpdate("DELETE FROM remembered_admin_sessions");
        }
    }
}
