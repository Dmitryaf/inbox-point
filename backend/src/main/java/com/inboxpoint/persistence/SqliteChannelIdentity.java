package com.inboxpoint.persistence;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;

public final class SqliteChannelIdentity implements AutoCloseable {
    private final Connection connection;

    public SqliteChannelIdentity(Path database, boolean readOnly) throws SQLException {
        connection = SqliteDatabase.openExisting(database, readOnly);
    }

    public String find(String channel) throws SQLException {
        return find(connection, channel);
    }

    static String find(Connection connection, String channel) throws SQLException {
        try (var query = connection.prepareStatement("SELECT identity FROM channel_connection_identities WHERE channel = ?")) {
            query.setString(1, channel);
            try (var rows = query.executeQuery()) {
                return rows.next() ? rows.getString("identity") : null;
            }
        }
    }

    public boolean confirmPrevious(String channel, String identity) throws SQLException {
        return SqliteDatabase.writeReturning(connection, () -> {
            try (var statement = connection.prepareStatement("""
                    INSERT INTO channel_connection_identities (channel, identity) VALUES (?, ?)
                    ON CONFLICT (channel) DO NOTHING
                    """)) {
                statement.setString(1, channel);
                statement.setString(2, identity);
                statement.executeUpdate();
            }
            return identity.equals(find(channel));
        });
    }

    @Override
    public void close() throws SQLException {
        connection.close();
    }
}
