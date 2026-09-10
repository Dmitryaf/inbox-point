package com.inboxpoint.admin;

import java.time.Clock;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class AdminSessionsTest {
    @Test
    void acceptsForwardedClientAndSchemeOnlyFromTheConfiguredImmediateProxy() {
        var origins = new AdminRequestOrigin("172.30.1.1/32,2001:db8::/32");
        var request = new org.springframework.mock.web.MockHttpServletRequest();
        request.addHeader("Host", "service.example.invalid");
        request.addHeader("Origin", "https://service.example.invalid");
        request.addHeader("X-Forwarded-Proto", "https");
        request.addHeader("X-Forwarded-For", "198.51.100.10");
        request.setRemoteAddr("172.30.1.1");
        assertThat(origins.inspect(request).client()).isEqualTo("198.51.100.10");
        assertThat(AdminRequestOrigin.sameOrigin(request, origins.inspect(request))).isTrue();
        request.setRemoteAddr("172.30.1.2");
        assertThat(origins.inspect(request).client()).isEqualTo("172.30.1.2");
        assertThat(AdminRequestOrigin.sameOrigin(request, origins.inspect(request))).isFalse();
    }

    @Test
    void protectsContentWithAnExpiringAndRevocableCookie() {
        var admin = new AdminSessions("synthetic-editor-password", true, Clock.systemUTC());
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        assertThat(admin.available(request, response)).isTrue();
        assertThat(admin.authorized(request, response)).isFalse();
        var login = admin.login("synthetic-editor-password", "address");
        assertThat(admin.cookie(login.token(), true)).contains("__Host-mh-admin-session=", "HttpOnly", "SameSite=Strict", "Secure");
        request.setCookies(new Cookie("__Host-mh-admin-session", login.token()));
        assertThat(admin.authorized(request, response)).isTrue();
        admin.logout(request);
        assertThat(admin.authorized(request, response)).isFalse();
    }

    @Test
    void limitsPasswordAttemptsAndRejectsARequestFromAnotherOrigin() {
        var admin = new AdminSessions("synthetic-editor-password", true, Clock.systemUTC());
        for (int attempt = 0; attempt < 4; attempt++) {
            assertThat(admin.login("incorrect", "address").retryAfter()).isZero();
        }
        assertThat(admin.login("incorrect", "address").retryAfter()).isEqualTo(900);
        assertThat(admin.login("synthetic-editor-password", "address").token()).isNull();
        var request = new MockHttpServletRequest();
        request.addHeader("Host", "127.0.0.1:3000");
        request.addHeader("Origin", "https://foreign.example.invalid");
        assertThat(admin.sameOrigin(request)).isFalse();
    }
}
