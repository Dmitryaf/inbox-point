package com.inboxpoint.operations;

import java.net.URI;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.Map;

import com.inboxpoint.InboxPointApplication;
import com.inboxpoint.persistence.BrowserData;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

public final class BrowserTestApplication {
    public static void main(String[] args) {
        new SpringApplicationBuilder(InboxPointApplication.class).profiles("browser-fixture").run(args);
    }

    @Configuration(proxyBeanMethods = false)
    @Profile("browser-fixture")
    static class Fixture {
        @Bean
        ChannelApiEndpoints localPlatforms(Environment environment) {
            var uri = URI.create(environment.getRequiredProperty("browser.fixture"));
            if (!"http".equals(uri.getScheme()) || !"127.0.0.1".equals(uri.getHost()) || uri.getPort() <= 0) {
                throw new IllegalArgumentException("Browser fixtures require an isolated loopback server");
            }
            return new ChannelApiEndpoints(uri, uri);
        }

        @Bean
        BrowserData browserData(Environment environment) throws SQLException {
            return new BrowserData(Path.of(environment.getRequiredProperty("DATABASE_PATH")),
                    environment.getRequiredProperty("browser.mode"));
        }
    }

    @RestController
    @Profile("browser-fixture")
    static class Evidence {
        private final BrowserData data;

        Evidence(BrowserData data) {
            this.data = data;
        }

        @GetMapping("/api/test/state")
        Map<String, Object> state() throws SQLException {
            return data.state();
        }

        @PostMapping("/api/test/recover/{id}")
        Map<String, Boolean> recover(@PathVariable String id) throws SQLException {
            return Map.of("changed", data.recover(id));
        }
    }
}
