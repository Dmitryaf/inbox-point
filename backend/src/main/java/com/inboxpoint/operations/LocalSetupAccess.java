package com.inboxpoint.operations;

import java.util.Set;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public final class LocalSetupAccess {
    private static final Set<String> LOOPBACK = Set.of("127.0.0.1", "::1", "0:0:0:0:0:0:0:1", "::ffff:127.0.0.1");
    private static final Set<String> LOCAL_NAMES = Set.of("localhost", "127.0.0.1", "::1", "[::1]", "[0:0:0:0:0:0:0:1]");

    private LocalSetupAccess() { }

    public static boolean allow(HttpServletRequest request, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        if (!LOOPBACK.contains(request.getRemoteAddr()) || !LOCAL_NAMES.contains(request.getServerName())) {
            return false;
        }
        var origin = request.getHeader("Origin");
        return origin == null || origin.equals(request.getScheme() + "://" + request.getHeader("Host"));
    }
}
