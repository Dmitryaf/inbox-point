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
        return "healthcheck".equals(command) || "availability-monitor".equals(command)
                || "snapshot-create".equals(command) || "snapshot-restore".equals(command);
    }

    public static int run(String[] args, Map<String, String> environment) {
        var command = args[0];
        if (command.startsWith("snapshot-")) {
            return snapshot(args, environment);
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
                var alert = new WebhookAlert(http, target, timeout, environment.get("MONITOR_ALERT_BEARER_TOKEN"));
                new AvailabilityMonitor(() -> check(http, readiness, timeout), alert::send).run(interval);
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

    private static int snapshot(String[] args, Map<String, String> environment) {
        try {
            if ("snapshot-create".equals(args[0])) {
                var database = Path.of(environment.getOrDefault("DATABASE_PATH", "./data/messenger-handoff.sqlite"));
                var days = number(environment, "CLOSED_REQUEST_RETENTION_DAYS", 7, 1, 365);
                System.out.println(new ServiceSnapshot(database, days).create(Instant.now()));
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
