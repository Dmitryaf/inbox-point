package com.inboxpoint.admin;

import java.time.Clock;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class AdminSessions extends PasswordSessions {
    @Autowired
    public AdminSessions(@Value("${ADMIN_PASSWORD:}") String password,
            @Value("${INBOXPOINT_ENV:development}") String environment,
            @Value("${HTTP_TRUSTED_PROXIES:}") String proxies,
            @Value("${DATABASE_PATH:./data/inbox-point.sqlite}") String database) {
        super(password, "production".equals(environment), "inbox-point-admin-session", Clock.systemUTC(), proxies, new RememberedSessions(java.nio.file.Path.of(database)));
    }

    AdminSessions(String password, boolean secure, Clock clock) {
        super(password, secure, "inbox-point-admin-session", clock, "", null);
    }
}
