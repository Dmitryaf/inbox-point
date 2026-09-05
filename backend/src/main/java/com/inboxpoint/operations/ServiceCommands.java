package com.inboxpoint.operations;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import com.inboxpoint.telegram.TelegramAlert;

public final class ServiceCommands {
    private ServiceCommands() { }

    public static boolean handles(String command) {
        return "healthcheck".equals(command) || "availability-monitor".equals(command);
    }

    public static int run(String command, Map<String, String> environment) {
        try (var http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build()) {
            if ("healthcheck".equals(command)) {
                int port = number(environment, "PORT", 3000, 1, 65535);
                check(http, URI.create("http://127.0.0.1:" + port + "/health"), Duration.ofSeconds(3));
            } else {
                var target = URI.create(environment.getOrDefault("MONITOR_HEALTH_URL", ""));
                if (!"https".equals(target.getScheme()) || target.getHost() == null || target.getUserInfo() != null) {
                    throw new IllegalArgumentException("Health endpoint must use HTTPS");
                }
                var interval = Duration.ofSeconds(number(environment, "MONITOR_INTERVAL_SECONDS", 60, 10, 86_400));
                var timeout = Duration.ofSeconds(number(environment, "MONITOR_TIMEOUT_SECONDS", 10, 1, 30));
                long chat = Long.parseLong(environment.getOrDefault("MONITOR_TELEGRAM_CHAT_ID", ""));
                var token = environment.getOrDefault("MONITOR_TELEGRAM_BOT_TOKEN", "");
                try (var alert = new TelegramAlert(token, chat, timeout)) {
                    new AvailabilityMonitor(() -> check(http, target, timeout), alert::send).run(interval);
                }
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
