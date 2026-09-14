package com.inboxpoint.persistence;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.inboxpoint.operations.InstanceId;
import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteConnection;
import org.sqlite.SQLiteOpenMode;
import tools.jackson.databind.json.JsonMapper;

public final class ServiceSnapshot {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final String MANIFEST = "manifest.json";
    private static final String DATABASE = "database.sqlite";
    private static final List<String> FILES = List.of(DATABASE, "content-settings.json", "service-control.json");
    private static final Set<String> TABLES = Set.of("support_requests", "conversation_messages",
            "processed_events", "message_links", "deliveries", "inbound_events", "usage_events", "operator_actions", "remembered_admin_sessions");
    private final Path database;
    private final Path directory;
    private final int days;
    private final String instance;

    public ServiceSnapshot(Path database, int days) {
        this(database, database.toAbsolutePath().normalize().getParent().resolve("snapshots"), "default", days);
    }

    public ServiceSnapshot(Path database, Path directory, String instance, int days) {
        if (database.toString().equals(":memory:") || days < 1 || days > 365) {
            throw new IllegalArgumentException("Invalid snapshot configuration");
        }
        this.database = database.toAbsolutePath().normalize();
        this.directory = directory.toAbsolutePath().normalize();
        this.days = days;
        this.instance = InstanceId.validate(instance);
    }

    public Path create(Instant created) throws IOException, SQLException {
        var prefix = "default".equals(instance) ? "inbox-point-snapshot-"
                : "inbox-point." + instance + ".snapshot-";
        var name = prefix + created.toString().replace(':', '-') + "-" + UUID.randomUUID();
        Files.createDirectories(directory);
        var staging = directory.resolve(name + ".tmp");
        var result = directory.resolve(name);
        privateDirectory(staging);
        try {
            var copy = staging.resolve(DATABASE);
            try (var source = openArchive(database, true)) {
                var code = source.unwrap(SQLiteConnection.class).getDatabase().backup("main", copy.toString(), null);
                if (code != 0) {
                    throw new SQLException("SQLite backup did not complete");
                }
            }
            privateFile(copy);
            var expires = retainCopy(copy, created, days);
            var entries = new ArrayList<FileEntry>();
            entries.add(fingerprint(copy, DATABASE));
            for (var nameToCopy : FILES.subList(1, FILES.size())) {
                var source = database.resolveSibling(nameToCopy);
                if (Files.exists(source, LinkOption.NOFOLLOW_LINKS)) {
                    if (!Files.isRegularFile(source, LinkOption.NOFOLLOW_LINKS)) {
                        throw new IOException("Snapshot state file is not a regular file");
                    }
                    var target = staging.resolve(nameToCopy);
                    Files.copy(source, target);
                    privateFile(target);
                    entries.add(fingerprint(target, nameToCopy));
                }
            }
            var manifest = new Manifest(days, created.toString(), expires.toString(),
                    entries, 1, instance, false, 7);
            var path = staging.resolve(MANIFEST);
            Files.writeString(path, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(manifest) + "\n");
            privateFile(path);
            verify(staging);
            Files.move(staging, result, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException | SQLException | RuntimeException failure) {
            cleanOwnedDirectory(staging, failure);
            throw failure;
        }
        expire(prefix, created, result);
        return result;
    }

    public static Manifest verify(Path directory) throws IOException, SQLException {
        var allowed = new HashSet<>(FILES);
        allowed.add(MANIFEST);
        try (var entries = Files.list(directory)) {
            if (entries.anyMatch(path -> !allowed.contains(path.getFileName().toString())
                    || !Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS))) {
                throw new IOException("Service snapshot contains an unexpected file");
            }
        }
        var json = JSON.readTree(Files.readString(directory.resolve(MANIFEST)));
        if (!json.isObject() || !json.path("secretsIncluded").isBoolean() || !json.path("files").isArray()) {
            throw new IOException("Service snapshot manifest is invalid");
        }
        var manifest = JSON.treeToValue(json, Manifest.class);
        if (manifest.formatVersion() != 1 || manifest.secretsIncluded() || manifest.sqliteSchemaVersion() != 7 || manifest.closedRequestRetentionDays() < 1
                || manifest.closedRequestRetentionDays() > 365
                || manifest.files().isEmpty() || manifest.files().getFirst() == null
                || !DATABASE.equals(manifest.files().getFirst().name())) {
            throw new IOException("Service snapshot manifest is invalid");
        }
        if (manifest.instanceId() != null) {
            InstanceId.validate(manifest.instanceId());
        }
        var created = Instant.parse(manifest.createdAt());
        Instant.parse(manifest.expiresAt());
        var names = new HashSet<String>();
        for (var entry : manifest.files()) {
            if (entry == null || !FILES.contains(entry.name()) || !names.add(entry.name())) {
                throw new IOException("Service snapshot manifest contains an invalid file name");
            }
            checkFingerprint(directory.resolve(entry.name()), entry);
        }
        try (var entries = Files.list(directory)) {
            if (entries.anyMatch(path -> !MANIFEST.equals(path.getFileName().toString()) && !names.contains(path.getFileName().toString()))) {
                throw new IOException("Service snapshot manifest does not match its files");
            }
        }
        try (var copy = openArchive(directory.resolve(DATABASE), true)) {
            verifyDatabase(copy, manifest.sqliteSchemaVersion());
            var cutoff = created.minus(manifest.closedRequestRetentionDays(), ChronoUnit.DAYS);
            if (SqliteRetention.oldestRetainedContent(copy).filter(value -> !value.isAfter(cutoff)).isPresent()) {
                throw new IOException("Service snapshot contains content due for retention");
            }
        }
        return manifest;
    }

    public static Path restore(Path snapshot, Path directory) throws IOException, SQLException {
        var target = directory.toAbsolutePath().normalize();
        if (target.getParent() == null) {
            throw new IOException("Snapshot restore target must not be a filesystem root");
        }
        var manifest = verify(snapshot);
        privateDirectory(target);
        var database = target.resolve("inbox-point.sqlite");
        try {
            for (var entry : manifest.files()) {
                var path = entry.name().equals(DATABASE) ? database : target.resolve(entry.name());
                Files.copy(snapshot.resolve(entry.name()), path);
                privateFile(path);
                checkFingerprint(path, entry);
            }
            try (var copy = openArchive(database, false); var statement = copy.createStatement()) {
                verifyDatabase(copy, 7);
                statement.execute("PRAGMA secure_delete = ON");
                statement.executeUpdate("DELETE FROM remembered_admin_sessions");
                verifyDatabase(copy, 7);
            }
            return database;
        } catch (IOException | SQLException | RuntimeException failure) {
            cleanOwnedDirectory(target, failure);
            throw failure;
        }
    }

    private static Instant retainCopy(Path database, Instant created, int days) throws SQLException {
        try (var copy = openArchive(database, false); var statement = copy.createStatement()) {
            statement.execute("PRAGMA journal_mode = DELETE");
            statement.execute("PRAGMA secure_delete = ON");
            SqliteRetention.purge(copy, created.minus(days, ChronoUnit.DAYS));
            statement.execute("VACUUM");
            var max = created.plus(days, ChronoUnit.DAYS);
            var oldest = SqliteRetention.oldestRetainedContent(copy).orElse(created).plus(days, ChronoUnit.DAYS);
            return oldest.isBefore(max) ? oldest : max;
        }
    }

    private static void verifyDatabase(Connection copy, int version) throws SQLException {
        try (var statement = copy.createStatement()) {
            try (var result = statement.executeQuery("PRAGMA integrity_check")) {
                if (!result.next() || !"ok".equalsIgnoreCase(result.getString(1)) || result.next()) {
                    throw new SQLException("Snapshot SQLite integrity check failed");
                }
            }
            try (var result = statement.executeQuery("PRAGMA user_version")) {
                if (!result.next() || result.getInt(1) != version) {
                    throw new SQLException("Snapshot SQLite version does not match the manifest");
                }
            }
            var required = new HashSet<>(TABLES);
            try (var result = statement.executeQuery("SELECT name FROM sqlite_master WHERE type = 'table'")) {
                while (result.next()) {
                    required.remove(result.getString(1));
                }
            }
            if (!required.isEmpty()) {
                throw new SQLException("Snapshot SQLite schema is incomplete");
            }
        }
    }

    private void expire(String prefix, Instant now, Path current) throws IOException {
        try (var entries = Files.list(directory)) {
            for (var candidate : entries.toList()) {
                if (candidate.equals(current) || !candidate.getFileName().toString().startsWith(prefix)
                        || !Files.isDirectory(candidate, LinkOption.NOFOLLOW_LINKS)) {
                    continue;
                }
                Manifest manifest;
                try {
                    manifest = verify(candidate);
                } catch (IOException | SQLException | RuntimeException invalid) {
                    continue;
                }
                if ((instance.equals(manifest.instanceId()) || manifest.instanceId() == null && "default".equals(instance))
                        && !Instant.parse(manifest.expiresAt()).isAfter(now)) {
                    for (var entry : manifest.files()) {
                        Files.delete(candidate.resolve(entry.name()));
                    }
                    Files.delete(candidate.resolve(MANIFEST));
                    Files.delete(candidate);
                }
            }
        }
    }

    private static FileEntry fingerprint(Path path, String name) throws IOException {
        try (var input = new DigestInputStream(Files.newInputStream(path), MessageDigest.getInstance("SHA-256"))) {
            var size = input.transferTo(OutputStream.nullOutputStream());
            return new FileEntry(name, HexFormat.of().formatHex(input.getMessageDigest().digest()), size);
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    private static void checkFingerprint(Path path, FileEntry expected) throws IOException {
        if (!Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS) || !expected.equals(fingerprint(path, expected.name()))) {
            throw new IOException("Service snapshot checksum failed for " + expected.name());
        }
    }

    private static void privateDirectory(Path path) throws IOException {
        if (Files.getFileStore(path.getParent()).supportsFileAttributeView(PosixFileAttributeView.class)) {
            Files.createDirectory(path, PosixFilePermissions.asFileAttribute(PosixFilePermissions.fromString("rwx------")));
        } else {
            Files.createDirectory(path);
        }
    }

    private static void privateFile(Path path) throws IOException {
        if (Files.getFileStore(path).supportsFileAttributeView(PosixFileAttributeView.class)) {
            Files.setPosixFilePermissions(path, PosixFilePermissions.fromString("rw-------"));
        }
    }

    private static void cleanOwnedDirectory(Path directory, Exception failure) {
        try (var entries = Files.list(directory)) {
            for (var entry : entries.toList()) {
                Files.delete(entry);
            }
            Files.delete(directory);
        } catch (IOException cleanup) {
            failure.addSuppressed(cleanup);
        }
    }

    private static Connection openArchive(Path path, boolean readOnly) throws SQLException {
        var config = new SQLiteConfig();
        config.setBusyTimeout(5_000);
        config.setReadOnly(readOnly);
        config.resetOpenMode(SQLiteOpenMode.CREATE);
        return config.createConnection("jdbc:sqlite:" + path);
    }

    public record FileEntry(String name, String sha256, long size) { }

    public record Manifest(int closedRequestRetentionDays, String createdAt, String expiresAt, List<FileEntry> files,
            int formatVersion, String instanceId, boolean secretsIncluded, int sqliteSchemaVersion) { }
}
