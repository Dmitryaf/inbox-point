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
    private static final Duration REMEMBERED = Duration.ofDays(30);
    private static final Duration SESSION = Duration.ofHours(12);
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);
    private static final SecureRandom RANDOM = new SecureRandom();
    private final byte[] secret;
    private final boolean secure;
    private final Clock clock;
    private final AdminRequestOrigin origin;
    private final RememberedSessions remembered;
    private final String cookieLabel;
    private final HashMap<String, Instant> sessions = new HashMap<>();
    private final HashMap<String, Attempts> attempts = new HashMap<>();

    PasswordSessions(String password, boolean secure, String cookieLabel, Clock clock, String trustedProxies, RememberedSessions remembered) {
        this.remembered = remembered;
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

    public Login login(String password, String client) {
        return login(password, client, false, null);
    }

    public synchronized Login login(String password, String client, boolean remember, HttpServletRequest request) {
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
        if (request != null) {
            logout(request);
        }
        var duration = remember ? REMEMBERED : SESSION;
        var key = sessionKey(token);
        if (remember && remembered != null) {
            remembered.save(key, now, now.plus(duration));
        } else {
            sessions.put(key, now.plus(duration));
        }
        return new Login(token, 0, duration.toSeconds());
    }

    public synchronized boolean accepted(String token) {
        if (secret == null || token == null || !token.matches("[A-Za-z0-9_-]{12,128}")) {
            return false;
        }
        var key = sessionKey(token);
        var expires = sessions.get(key);
        if (expires != null && expires.isAfter(clock.instant())) {
            return true;
        }
        sessions.remove(key);
        return remembered != null && remembered.active(key, clock.instant());
    }

    public synchronized void logout(HttpServletRequest request) {
        var value = token(request);
        if (secret != null && value != null && value.matches("[A-Za-z0-9_-]{12,128}")) {
            var key = sessionKey(value);
            sessions.remove(key);
            if (remembered != null) {
                remembered.delete(key);
            }
        }
    }

    public synchronized void revokeAll() {
        if (remembered != null) {
            remembered.clear();
        }
        sessions.clear();
    }

    private String sessionKey(String value) {
        try {
            var mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(secret, "HmacSHA256"));
            return java.util.HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException unavailable) {
            throw new IllegalStateException("Administrator session hash is unavailable", unavailable);
        }
    }

    public String cookie(String value, boolean active) {
        return cookie(value, active ? SESSION : Duration.ZERO);
    }

    String cookie(String value, Duration maxAge) {
        return ResponseCookie.from(cookieName(), value).path("/").httpOnly(true)
                .sameSite("Strict").secure(secure).maxAge(maxAge).build().toString();
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

    public record Login(String token, long retryAfter, long maxAgeSeconds) {
        Login(String token, long retryAfter) {
            this(token, retryAfter, 0);
        }
    }

    private record Attempts(int count, Instant expires) { }
}
