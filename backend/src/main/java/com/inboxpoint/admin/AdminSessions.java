package com.inboxpoint.admin;

import java.time.Clock;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class AdminSessions extends PasswordSessions {
    @Autowired
    public AdminSessions(@Value("${ADMIN_PASSWORD:}") String password,
            @Value("${INBOXPOINT_ENV:development}") String environment) {
        this(password, "production".equals(environment), Clock.systemUTC());
    }

    AdminSessions(String password, boolean secure, Clock clock) {
        super(password, secure, "mh-admin-session", clock);
    }
}
