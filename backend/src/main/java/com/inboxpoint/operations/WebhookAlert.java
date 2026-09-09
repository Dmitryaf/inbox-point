package com.inboxpoint.operations;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import tools.jackson.databind.json.JsonMapper;

record WebhookAlert(HttpClient client, URI target, Duration timeout, String bearer) {
    WebhookAlert {
        if (bearer != null && (bearer.length() > 500 || bearer.chars().anyMatch(Character::isISOControl))) {
            throw new IllegalArgumentException("Invalid alert credential");
        }
    }

    static URI https(String value) {
        var address = URI.create(value == null ? "" : value);
        if (!"https".equalsIgnoreCase(address.getScheme()) || address.getHost() == null
                || address.getUserInfo() != null || address.getFragment() != null) {
            throw new IllegalArgumentException("Expected an HTTPS endpoint");
        }
        return address;
    }

    HttpRequest request(String text) {
        var payload = JsonMapper.shared().writeValueAsString(Map.of("message", text, "service", "messenger-handoff"));
        var request = HttpRequest.newBuilder(target).timeout(timeout).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload));
        if (bearer != null && !bearer.isEmpty()) {
            request.header("Authorization", "Bearer " + bearer);
        }
        return request.build();
    }

    void send(String text) throws IOException, InterruptedException {
        var response = client.send(request(text), HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Alert webhook rejected the notification");
        }
    }
}
