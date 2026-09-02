package com.inboxpoint.content;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;

import com.inboxpoint.operations.LocalSetupAccess;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public final class ContentAdmin {
    private static final Duration SESSION = Duration.ofHours(12);
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final byte[] secret;
    private final boolean secure;
    private final Clock clock;
    private final HashMap<String, Instant> sessions = new HashMap<>();
    private final HashMap<String, Attempts> attempts = new HashMap<>();

    @Autowired
    public ContentAdmin(@Value("${CONTENT_ADMIN_PASSWORD:}") String password,
            @Value("${INBOXPOINT_ENV:development}") String environment) {
        this(password, "production".equals(environment), Clock.systemUTC());
    }

    ContentAdmin(String password, boolean secure, Clock clock) {
        if (!password.isEmpty() && (password.length() < 12 || password.length() > 200)) {
            throw new IllegalArgumentException("Invalid content administration password length");
        }
        this.secret = password.isEmpty() ? null : hash(password);
        this.secure = secure;
        this.clock = clock;
    }

    public boolean available(HttpServletRequest request, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-Content-Type-Options", "nosniff");
        return secret != null || local(request, response);
    }

    boolean authorized(HttpServletRequest request, HttpServletResponse response) {
        return local(request, response) || accepted(token(request));
    }

    private boolean local(HttpServletRequest request, HttpServletResponse response) {
        return !secure && LocalSetupAccess.allow(request, response);
    }

    static boolean sameOrigin(HttpServletRequest request) {
        var origin = request.getHeader("Origin");
        if (origin == null) {
            return true;
        }
        var host = request.getHeader("Host");
        return origin.equals("https://" + host) || (!request.isSecure() && origin.equals("http://" + host));
    }

    synchronized Login login(String password, String client) {
        var now = clock.instant();
        attempts.entrySet().removeIf(entry -> !entry.getValue().expires().isAfter(now));
        var previous = attempts.get(client);
        if (previous != null && previous.count() >= 5) {
            return new Login(null, Math.clamp(Duration.between(now, previous.expires()).toSeconds(), 1, 900));
        }
        if (secret == null || password.length() > 200 || !MessageDigest.isEqual(secret, hash(password))) {
            var count = previous == null ? 1 : previous.count() + 1;
            var expires = previous == null || count >= 5 ? now.plus(ATTEMPT_WINDOW) : previous.expires();
            attempts.put(client, new Attempts(count, expires));
            return new Login(null, count >= 5 ? ATTEMPT_WINDOW.toSeconds() : 0);
        }
        attempts.remove(client);
        sessions.entrySet().removeIf(entry -> !entry.getValue().isAfter(now));
        byte[] value = new byte[32];
        RANDOM.nextBytes(value);
        var token = Base64.getUrlEncoder().withoutPadding().encodeToString(value);
        sessions.put(token, now.plus(SESSION));
        return new Login(token, 0);
    }

    synchronized boolean accepted(String token) {
        if (token == null) {
            return false;
        }
        var expires = sessions.get(token);
        if (expires != null && expires.isAfter(clock.instant())) {
            return true;
        }
        sessions.remove(token);
        return false;
    }

    synchronized void logout(HttpServletRequest request) {
        sessions.remove(token(request));
    }

    String cookie(String value, boolean active) {
        return ResponseCookie.from(cookieName(), value).path("/").httpOnly(true)
                .sameSite("Strict").secure(secure).maxAge(active ? SESSION : Duration.ZERO).build().toString();
    }

    private String token(HttpServletRequest request) {
        var cookies = request.getCookies();
        if (cookies != null) {
            for (var cookie : cookies) {
                if (cookieName().equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    private String cookieName() {
        return secure ? "__Host-mh-content-session" : "mh-content-session";
    }

    private static byte[] hash(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    record Login(String token, long retryAfter) { }

    private record Attempts(int count, Instant expires) { }
}
