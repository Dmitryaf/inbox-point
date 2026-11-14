package com.inboxpoint.persistence;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;

import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteOpenMode;

final class SqliteDatabase {
    private static final DateTimeFormatter SQL_TIMESTAMP = new DateTimeFormatterBuilder()
            .appendInstant(3)
            .toFormatter();

    private SqliteDatabase() {
    }

    static Connection openOrMigrate(Path databasePath) throws SQLException {
        try {
            Files.createDirectories(databasePath.toAbsolutePath().getParent());
        } catch (IOException failure) {
            throw new SQLException("Could not create the SQLite data directory", failure);
        }
        return open(databasePath, true);
    }

    static Connection openExisting(Path databasePath) throws SQLException {
        return open(databasePath, false);
    }

    static Connection openExisting(Path databasePath, boolean readOnly) throws SQLException {
        var connection = openArchive(databasePath, readOnly);
        try {
            SqliteSchema.requireCurrentVersion(connection);
            return connection;
        } catch (SQLException | RuntimeException failure) {
            try {
                connection.close();
            } catch (SQLException closeFailure) {
                failure.addSuppressed(closeFailure);
            }
            throw failure;
        }
    }

    static Connection openArchive(Path databasePath, boolean readOnly) throws SQLException {
        var config = connectionConfig();
        config.setReadOnly(readOnly);
        config.resetOpenMode(SQLiteOpenMode.CREATE);
        return config.createConnection(databaseUrl(databasePath));
    }

    private static Connection open(Path databasePath, boolean migrate) throws SQLException {
        var config = connectionConfig();
        if (!migrate) {
            config.resetOpenMode(SQLiteOpenMode.CREATE);
        }
        var connection = config.createConnection(databaseUrl(databasePath));
        try {
            if (migrate) {
                SqliteSchema.initialize(connection);
            } else {
                SqliteSchema.requireCurrentVersion(connection);
            }
            enableWal(connection);
            return connection;
        } catch (SQLException | RuntimeException failure) {
            try {
                connection.close();
            } catch (SQLException closeFailure) {
                failure.addSuppressed(closeFailure);
            }
            throw failure;
        }
    }

    private static SQLiteConfig connectionConfig() {
        var config = new SQLiteConfig();
        config.enforceForeignKeys(true);
        config.setBusyTimeout(5_000);
        config.setSynchronous(SQLiteConfig.SynchronousMode.FULL);
        return config;
    }

    private static String databaseUrl(Path path) {
        return "jdbc:sqlite:" + path.toUri().toASCIIString();
    }

    static String timestamp(Instant instant) {
        return SQL_TIMESTAMP.format(instant);
    }

    static void writeTransaction(Connection connection, WriteOperation operation) throws SQLException {
        writeReturning(connection, () -> {
            operation.execute();
            return null;
        });
    }

    static <T> T writeReturning(Connection connection, WriteResult<T> operation) throws SQLException {
        try (var transaction = connection.createStatement()) {
            transaction.execute("BEGIN IMMEDIATE");
            try {
                var result = operation.execute();
                transaction.execute("COMMIT");
                return result;
            } catch (SQLException | RuntimeException failure) {
                try {
                    transaction.execute("ROLLBACK");
                } catch (SQLException rollbackFailure) {
                    failure.addSuppressed(rollbackFailure);
                }
                throw failure;
            }
        }
    }

    private static void enableWal(Connection connection) throws SQLException {
        try (var statement = connection.createStatement();
                var rows = statement.executeQuery("PRAGMA journal_mode = WAL")) {
            if (!rows.next() || !"wal".equalsIgnoreCase(rows.getString(1))) {
                throw new SQLException("SQLite could not enable write-ahead logging");
            }
        }
    }

    @FunctionalInterface
    interface WriteOperation {
        void execute() throws SQLException;
    }

    @FunctionalInterface
    interface WriteResult<T> {
        T execute() throws SQLException;
    }
}
