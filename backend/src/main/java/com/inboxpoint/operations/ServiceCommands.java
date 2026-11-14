package com.inboxpoint.operations;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import com.inboxpoint.persistence.ServiceSnapshot;

public final class ServiceCommands {
    private ServiceCommands() { }

    public static boolean handles(String command) {
        return "channel-confirm".equals(command) || "healthcheck".equals(command) || "availability-monitor".equals(command)
                || "snapshot-verify".equals(command) || "snapshot-create".equals(command) || "snapshot-restore".equals(command) || "backup-create".equals(command);
    }

    public static int run(String[] args, Map<String, String> environment) {
        var command = args[0];
        if ("channel-confirm".equals(command)) {
            return com.inboxpoint.telegram.ChannelIdentityCommand.run(args, environment);
        }
        if (command.startsWith("snapshot-")) {
            return snapshot(args, environment);
        }
        if ("backup-create".equals(command)) {
            return backup(environment);
        }
        try (var http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()) {
            if ("healthcheck".equals(command)) {
                int port = number(environment, "PORT", 3000, 1, 65535);
                check(http, URI.create("http://127.0.0.1:" + port + "/health"), Duration.ofSeconds(3));
            } else {
                var readiness = WebhookAlert.https(environment.get("MONITOR_READINESS_URL"));
                if (!readiness.getPath().endsWith("/ready")) {
                    throw new IllegalArgumentException("Expected an HTTPS readiness endpoint");
                }
                var target = WebhookAlert.https(environment.get("MONITOR_ALERT_WEBHOOK_URL"));
                var interval = Duration.ofSeconds(number(environment, "MONITOR_INTERVAL_SECONDS", 60, 10, Integer.MAX_VALUE));
                var timeout = Duration.ofSeconds(number(environment, "MONITOR_TIMEOUT_SECONDS", 10, 1, 30));
                var alert = new WebhookAlert(http, target, timeout, environment.get("MONITOR_ALERT_BEARER_TOKEN"), instance(environment));
                new AvailabilityMonitor(() -> check(http, readiness, timeout), alert::send, instance(environment)).run(interval);
            }
            return 0;
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
            return 0;
        } catch (IOException | IllegalArgumentException invalid) {
            System.err.println("Service check or monitor could not initialize or continue.");
            return 1;
        }
    }

    private static int backup(Map<String, String> environment) {
        try (var http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()) {
            var database = Path.of(required(environment, "DATABASE_PATH")).toAbsolutePath().normalize();
            var target = Path.of(required(environment, "BACKUP_EXPORT_PATH")).toAbsolutePath().normalize();
            requireExternalTarget(database, target);
            var timeout = Duration.ofSeconds(number(environment, "BACKUP_TIMEOUT_SECONDS", 10, 1, 30));
            var notifier = new WebhookAlert(http, WebhookAlert.https(environment.get("BACKUP_ALERT_WEBHOOK_URL")),
                    timeout, environment.get("BACKUP_ALERT_BEARER_TOKEN"), instance(environment));
            try {
                var snapshot = new ServiceSnapshot(database, target, instance(environment), number(environment, "CLOSED_REQUEST_RETENTION_DAYS", 7, 1, 365))
                        .create(Instant.now());
                ServiceSnapshot.verify(snapshot);
                System.out.println(snapshot);
                return 0;
            } catch (IOException | SQLException | RuntimeException failure) {
                try {
                    notifier.send("Не удалось создать или проверить внешний backup.");
                } catch (IOException alertFailed) {
                    System.err.println("External backup alert could not be delivered");
                }
                System.err.println("External backup failed (" + failure.getClass().getSimpleName() + ")");
                return 1;
            }
        } catch (IllegalArgumentException invalid) {
            System.err.println("External backup configuration is invalid");
            return 1;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return 1;
        }
    }

    static void requireExternalTarget(Path database, Path target) {
        if (target.startsWith(database.getParent())) {
            throw new IllegalArgumentException("Backup export must be outside the application data directory");
        }
    }

    private static String instance(Map<String, String> environment) {
        return InstanceId.validate(environment.getOrDefault("INSTANCE_ID", "default"));
    }

    private static String required(Map<String, String> environment, String key) {
        var value = environment.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing backup configuration");
        }
        return value;
    }

    private static int snapshot(String[] args, Map<String, String> environment) {
        try {
            if ("snapshot-create".equals(args[0])) {
                var database = Path.of(environment.getOrDefault("DATABASE_PATH", "./data/inbox-point.sqlite"));
                var days = number(environment, "CLOSED_REQUEST_RETENTION_DAYS", 7, 1, 365);
                System.out.println(new ServiceSnapshot(database, database.toAbsolutePath().normalize().getParent().resolve("snapshots"),
                        instance(environment), days).create(Instant.now()));
            } else if ("snapshot-verify".equals(args[0])) {
                if (args.length != 2) {
                    throw new IllegalArgumentException("Snapshot directory is required");
                }
                ServiceSnapshot.verify(Path.of(args[1]));
            } else {
                if (args.length != 3) {
                    throw new IllegalArgumentException("Snapshot directory and new restore directory are required");
                }
                System.out.println(ServiceSnapshot.restore(Path.of(args[1]), Path.of(args[2])));
            }
            return 0;
        } catch (IOException | SQLException | RuntimeException failure) {
            System.err.println("Service snapshot command failed (" + failure.getClass().getSimpleName() + ")");
            return 1;
        }
    }

    private static void check(HttpClient client, URI target, Duration timeout) throws IOException, InterruptedException {
        var response = client.send(HttpRequest.newBuilder(target).timeout(timeout).GET().build(),
                HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Availability probe failed");
        }
    }

    private static int number(Map<String, String> values, String key, int fallback, int min, int max) {
        var value = Integer.parseInt(values.getOrDefault(key, Integer.toString(fallback)));
        if (value < min || value > max) {
            throw new IllegalArgumentException("Invalid availability setting");
        }
        return value;
    }
}
