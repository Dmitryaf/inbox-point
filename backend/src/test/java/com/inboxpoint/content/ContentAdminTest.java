package com.inboxpoint.content;

import java.time.Clock;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class ContentAdminTest {
    @Test
    void protectsContentWithAnExpiringAndRevocableCookie() {
        var admin = new ContentAdmin("synthetic-editor-password", true, Clock.systemUTC());
        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();
        assertThat(admin.available(request, response)).isTrue();
        assertThat(admin.authorized(request, response)).isFalse();
        var login = admin.login("synthetic-editor-password", "address");
        assertThat(admin.cookie(login.token(), true)).contains("__Host-mh-content-session=", "HttpOnly", "SameSite=Strict", "Secure");
        request.setCookies(new Cookie("__Host-mh-content-session", login.token()));
        assertThat(admin.authorized(request, response)).isTrue();
        admin.logout(request);
        assertThat(admin.authorized(request, response)).isFalse();
    }

    @Test
    void limitsPasswordAttemptsAndRejectsARequestFromAnotherOrigin() {
        var admin = new ContentAdmin("synthetic-editor-password", true, Clock.systemUTC());
        for (int attempt = 0; attempt < 4; attempt++) {
            assertThat(admin.login("incorrect", "address").retryAfter()).isZero();
        }
        assertThat(admin.login("incorrect", "address").retryAfter()).isEqualTo(900);
        assertThat(admin.login("synthetic-editor-password", "address").token()).isNull();
        var request = new MockHttpServletRequest();
        request.addHeader("Host", "127.0.0.1:3000");
        request.addHeader("Origin", "https://foreign.example.invalid");
        assertThat(ContentAdmin.sameOrigin(request)).isFalse();
    }
}
