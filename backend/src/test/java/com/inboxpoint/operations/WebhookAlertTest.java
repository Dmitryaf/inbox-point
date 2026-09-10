package com.inboxpoint.operations;

import java.net.http.HttpClient;
import java.time.Duration;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WebhookAlertTest {
    @Test
    void createsATimedJsonPostForAnIndependentHttpsReceiver() {
        assertThatThrownBy(() -> WebhookAlert.https("http://alerts.example.invalid/receive"))
                .isInstanceOf(IllegalArgumentException.class);
        var target = WebhookAlert.https("https://alerts.example.invalid/receive");
        try (var client = HttpClient.newHttpClient()) {
            var request = new WebhookAlert(client, target, Duration.ofSeconds(3), "synthetic-token", "instance-a").request("Synthetic alert");
            assertThat(request.uri()).isEqualTo(target);
            assertThat(request.method()).isEqualTo("POST");
            assertThat(request.timeout()).contains(Duration.ofSeconds(3));
            assertThat(request.headers().firstValue("Content-Type")).contains("application/json");
            assertThat(request.headers().firstValue("Authorization")).contains("Bearer synthetic-token");
        }
    }
}
