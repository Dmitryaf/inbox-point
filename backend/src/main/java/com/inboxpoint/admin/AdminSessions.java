package com.inboxpoint.admin;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.inboxpoint.persistence.SqliteAdminSessions;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
final class AdminSessions {
    private static final long ATTEMPT_WINDOW = Duration.ofMinutes(15).toMillis();
    private static final long SESSION_TTL = Duration.ofHours(12).toMillis();
    private static final long REMEMBERED_TTL = Duration.ofDays(30).toMillis();
    private static final Pattern TOKENS = Pattern.compile("[A-Za-z0-9_-]{12,128}");

    private final SecureRandom random = new SecureRandom();
    private final Clock clock = Clock.systemUTC();
    private final Map<String, Long> currentSessions = new HashMap<>();
    private final Map<String, FailedLogins> failed = new HashMap<>();
    private final SqliteAdminSessions remembered;
    private final SecretKeySpec tokenKey;
    private final byte[] passwordDigest;
    private final boolean secure;

    AdminSessions(Environment environment) {
        var password = environment.getProperty("ADMIN_PASSWORD", "");
        if (!password.isEmpty() && (password.length() < 12 || password.length() > 200)) {
            throw new IllegalArgumentException("Invalid admin password length");
        }
        tokenKey = password.isEmpty() ? null : new SecretKeySpec(password.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        passwordDigest = password.isEmpty() ? null : digest(password);
        secure = "production".equals(environment.getProperty("INBOXPOINT_ENV"));
        remembered = new SqliteAdminSessions(Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite")));
    }

    boolean configured() {
        return tokenKey != null;
    }

    boolean secure() {
        return secure;
    }

    synchronized boolean authenticate(String token) throws SQLException {
        var hash = hashToken(token);
        if (hash == null) {
            return false;
        }
        var now = clock.millis();
        var expires = currentSessions.get(hash);
        if (expires != null && expires > now) {
            return true;
        }
        currentSessions.remove(hash);
        return remembered.hasActive(hash, now);
    }

    synchronized Login login(String password, String client, boolean remember, String previous) throws SQLException {
        var now = clock.millis();
        failed.values().removeIf(state -> state.blockedUntil() <= now && now - state.startedAt() >= ATTEMPT_WINDOW);
        var recent = failed.get(client);
        if (recent != null && recent.blockedUntil() > now) {
            return new Login(null, Math.ceilDiv(recent.blockedUntil() - now, 1_000), false);
        }
        if (passwordDigest == null || !MessageDigest.isEqual(digest(password), passwordDigest)) {
            var attempts = recent == null ? 1 : recent.attempts() + 1;
            var started = recent == null ? now : recent.startedAt();
            var blocked = attempts >= 5;
            failed.put(client, new FailedLogins(attempts, started, blocked ? now + ATTEMPT_WINDOW : 0));
            return new Login(null, blocked ? ATTEMPT_WINDOW / 1_000 : 0, false);
        }

        var seed = new byte[32];
        random.nextBytes(seed);
        var token = Base64.getUrlEncoder().withoutPadding().encodeToString(seed);
        var next = hashToken(token);
        var old = hashToken(previous);
        var ttl = remember ? REMEMBERED_TTL : SESSION_TTL;
        remembered.rotate(old, remember ? next : null, now, now + ttl);
        failed.remove(client);
        currentSessions.remove(old);
        currentSessions.values().removeIf(expires -> expires <= now);
        if (!remember) {
            currentSessions.put(next, now + ttl);
        }
        return new Login(token, ttl / 1_000, true);
    }

    synchronized void logout(String token) throws SQLException {
        var hash = hashToken(token);
        remembered.rotate(hash, null, 0, 0);
        currentSessions.remove(hash);
    }

    synchronized void revokeAll() throws SQLException {
        remembered.revokeAll();
        currentSessions.clear();
    }

    private String hashToken(String token) {
        if (tokenKey == null || token == null || !TOKENS.matcher(token).matches()) {
            return null;
        }
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(tokenKey);
            return HexFormat.of().formatHex(mac.doFinal(token.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException impossible) {
            throw new IllegalStateException("HmacSHA256 is unavailable", impossible);
        }
    }

    private static byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }

    record Login(String token, long seconds, boolean authenticated) { }

    private record FailedLogins(int attempts, long startedAt, long blockedUntil) { }
}
