package com.inboxpoint.operations;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Set;

import com.inboxpoint.persistence.ServiceSnapshot;
import tools.jackson.databind.json.JsonMapper;

public final class ServiceCommands {
    private static final Set<String> COMMANDS = Set.of("snapshot-create", "snapshot-verify", "snapshot-restore",
            "backup-create", "availability-monitor", "healthcheck");
    private static final JsonMapper JSON = JsonMapper.shared();

    private ServiceCommands() { }

    public static boolean isCommand(String command) {
        return COMMANDS.contains(command);
    }

    public static int run(String command, String[] args, Map<String, String> environment) {
        try {
            switch (command) {
                case "snapshot-create" -> System.out.println(createSnapshot(environment, null));
                case "snapshot-verify" -> ServiceSnapshot.verify(path(args, 0));
                case "snapshot-restore" -> System.out.println(ServiceSnapshot.restore(path(args, 0), path(args, 1)));
                case "backup-create" -> backup(environment);
                case "availability-monitor" -> monitor(environment);
                case "healthcheck" -> {
                    var port = number(environment, "PORT", 3000, 1, 65_535);
                    try (var http = HttpClient.newHttpClient()) {
                        check(http, URI.create("http://127.0.0.1:" + port + "/health"), Duration.ofSeconds(5));
                    }
                }
                default -> throw new IllegalArgumentException("Unknown service command");
            }
            return 0;
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            return 1;
        } catch (Exception failed) {
            System.err.println("Inbox Point " + command + " failed (" + failed.getClass().getSimpleName() + ")");
            return 1;
        }
    }

    private static Path createSnapshot(Map<String, String> environment, Path external) throws Exception {
        var database = Path.of(environment.getOrDefault("DATABASE_PATH", "./data/inbox-point.sqlite")).toAbsolutePath().normalize();
        var instance = instance(environment);
        var days = number(environment, "CLOSED_REQUEST_RETENTION_DAYS", 7, 1, 365);
        var target = database.getParent().resolve("snapshots");
        if (external != null) {
            target = external.toAbsolutePath().normalize();
            if (!environment.containsKey("DATABASE_PATH") || target.startsWith(database.getParent())) {
                throw new IllegalArgumentException("Backup export path must be outside the application data");
            }
        }
        return new ServiceSnapshot(database, target, instance, days).create(Instant.now());
    }

    private static void backup(Map<String, String> environment) throws Exception {
        var alert = https(environment.get("BACKUP_ALERT_WEBHOOK_URL"));
        var timeout = Duration.ofSeconds(number(environment, "BACKUP_TIMEOUT_SECONDS", 10, 1, 30));
        var instance = instance(environment);
        var bearer = bearer(environment, "BACKUP_ALERT_BEARER_TOKEN");
        try {
            var path = createSnapshot(environment, Path.of(required(environment, "BACKUP_EXPORT_PATH")));
            ServiceSnapshot.verify(path);
            System.out.println(path);
        } catch (Exception failed) {
            try (var http = HttpClient.newHttpClient()) {
                notify(http, alert, timeout, instance, bearer, "Inbox Point [" + instance
                        + "]: не удалось создать или проверить внешний backup.");
            } catch (IOException noticeFailed) {
                System.err.println("Inbox Point backup alert delivery failed");
            }
            throw failed;
        }
    }

    private static void monitor(Map<String, String> environment) throws IOException, InterruptedException {
        var url = https(environment.get("MONITOR_READINESS_URL"));
        if (!url.getPath().endsWith("/ready")) {
            throw new IllegalArgumentException("Expected readiness URL");
        }
        var target = https(environment.get("MONITOR_ALERT_WEBHOOK_URL"));
        var bearer = bearer(environment, "MONITOR_ALERT_BEARER_TOKEN");
        var timeout = Duration.ofSeconds(number(environment, "MONITOR_TIMEOUT_SECONDS", 10, 1, 30));
        var delay = Duration.ofSeconds(number(environment, "MONITOR_INTERVAL_SECONDS", 60, 10, Integer.MAX_VALUE));
        var instance = instance(environment);
        boolean alerted = false;
        try (var http = HttpClient.newHttpClient()) {
            while (!Thread.currentThread().isInterrupted()) {
                boolean available;
                try {
                    check(http, url, timeout);
                    available = true;
                } catch (IOException failure) {
                    available = false;
                    System.err.println("Inbox Point [" + instance + "] availability check failed");
                }
                if (available && alerted) {
                    sendAlert(http, target, timeout, instance, bearer, "Inbox Point [" + instance + "] снова доступен.");
                    alerted = false;
                } else if (!available && !alerted) {
                    alerted = sendAlert(http, target, timeout, instance, bearer,
                            "Inbox Point [" + instance + "] недоступен. Проверьте сервер и контейнер приложения.");
                }
                Thread.sleep(delay);
            }
        }
    }

    private static boolean sendAlert(HttpClient http, URI target, Duration timeout, String instance, String bearer, String message)
            throws InterruptedException {
        try {
            notify(http, target, timeout, instance, bearer, message);
            return true;
        } catch (IOException failed) {
            System.err.println("Inbox Point [" + instance + "] availability alert delivery failed");
            return false;
        }
    }

    private static void notify(HttpClient http, URI target, Duration timeout, String instance, String bearer, String message)
            throws IOException, InterruptedException {
        var json = JSON.writeValueAsString(Map.of("instanceId", instance, "message", message, "service", "inbox-point"));
        var request = HttpRequest.newBuilder(target).timeout(timeout).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json));
        if (!bearer.isEmpty()) {
            request.header("Authorization", "Bearer " + bearer);
        }
        accept(http, request.build());
    }

    private static void check(HttpClient http, URI target, Duration timeout) throws IOException, InterruptedException {
        accept(http, HttpRequest.newBuilder(target).timeout(timeout).GET().build());
    }

    private static void accept(HttpClient http, HttpRequest request) throws IOException, InterruptedException {
        var code = http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
        if (code < 200 || code >= 300) {
            throw new IOException("Unexpected HTTP status");
        }
    }

    private static Path path(String[] args, int index) {
        if (index >= args.length || args[index].isBlank()) {
            throw new IllegalArgumentException("Missing command path");
        }
        return Path.of(args[index]);
    }

    private static String required(Map<String, String> values, String key) {
        var value = values.getOrDefault(key, "");
        if (value.isBlank()) {
            throw new IllegalArgumentException("Missing command configuration");
        }
        return value;
    }

    private static String instance(Map<String, String> values) {
        var name = values.getOrDefault("INSTANCE_ID", "default");
        if (!ServiceSnapshot.validInstance(name)) {
            throw new IllegalArgumentException("Invalid instance identifier");
        }
        return name;
    }

    private static String bearer(Map<String, String> values, String key) {
        var token = values.getOrDefault(key, "");
        if (token.length() > 500) {
            throw new IllegalArgumentException("Invalid alert credentials");
        }
        return token;
    }

    private static URI https(String url) {
        var value = URI.create(url == null ? "" : url);
        if (!"https".equals(value.getScheme()) || value.getHost() == null || value.getRawUserInfo() != null) {
            throw new IllegalArgumentException("Expected HTTPS endpoint");
        }
        return value;
    }

    private static int number(Map<String, String> values, String key, int fallback, int min, int max) {
        var value = Integer.parseInt(values.getOrDefault(key, Integer.toString(fallback)));
        if (value < min || value > max) {
            throw new IllegalArgumentException("Invalid numeric configuration");
        }
        return value;
    }
}
