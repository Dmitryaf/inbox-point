package com.inboxpoint.admin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;

public class PasswordSessions {
    private static final Duration SESSION = Duration.ofHours(12);
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final byte[] secret;
    private final boolean secure;
    private final Clock clock;
    private final AdminRequestOrigin origin;
    private final String cookieLabel;
    private final HashMap<String, Instant> sessions = new HashMap<>();
    private final HashMap<String, Attempts> attempts = new HashMap<>();

    PasswordSessions(String password, boolean secure, String cookieLabel, Clock clock, String trustedProxies) {
        origin = new AdminRequestOrigin(trustedProxies);
        if (!password.isEmpty() && (password.length() < 12 || password.length() > 200)) {
            throw new IllegalArgumentException("Invalid administration password length");
        }
        this.secret = password.isEmpty() ? null : hash(password);
        this.secure = secure;
        this.clock = clock;
        this.cookieLabel = cookieLabel;
    }

    public boolean available(HttpServletRequest request, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-Content-Type-Options", "nosniff");
        return secret != null || local(request, response);
    }

    public boolean authorized(HttpServletRequest request, HttpServletResponse response) {
        return local(request, response) || accepted(token(request));
    }

    final boolean local(HttpServletRequest request, HttpServletResponse response) {
        return secret == null && !secure && origin.inspect(request).loopback();
    }

    public boolean sameOrigin(HttpServletRequest request) {
        return AdminRequestOrigin.sameOrigin(request, origin.inspect(request));
    }

    String clientAddress(HttpServletRequest request) {
        return origin.inspect(request).client();
    }

    public synchronized Login login(String password, String client) {
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

    public synchronized boolean accepted(String token) {
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

    public synchronized void logout(HttpServletRequest request) {
        sessions.remove(token(request));
    }

    public String cookie(String value, boolean active) {
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
        return secure ? "__Host-" + cookieLabel : cookieLabel;
    }

    private static byte[] hash(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException("SHA-256 is unavailable", unavailable);
        }
    }

    public record Login(String token, long retryAfter) { }

    private record Attempts(int count, Instant expires) { }
}
