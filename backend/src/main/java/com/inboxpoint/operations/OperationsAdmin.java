package com.inboxpoint.operations;

import java.time.Clock;

import com.inboxpoint.admin.PasswordSessions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public final class OperationsAdmin extends PasswordSessions {
    public OperationsAdmin(@Value("${OPS_ADMIN_PASSWORD:}") String password,
            @Value("${INBOXPOINT_ENV:development}") String environment) {
        super(password, "production".equals(environment), "mh-ops-session", Clock.systemUTC());
    }
}
