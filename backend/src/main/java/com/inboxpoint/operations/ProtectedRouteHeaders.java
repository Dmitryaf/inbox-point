package com.inboxpoint.operations;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
final class ProtectedRouteHeaders extends OncePerRequestFilter {
    private static final List<String> SCOPES = List.of("/setup", "/manage", "/ops",
            "/api/setup", "/api/manage", "/api/ops");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain next)
            throws ServletException, IOException {
        var path = request.getRequestURI();
        if (SCOPES.stream().anyMatch(scope -> path.equals(scope) || path.startsWith(scope + "/"))) {
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("Referrer-Policy", "no-referrer");
            response.setHeader("X-Frame-Options", "DENY");
            response.setHeader("X-Content-Type-Options", "nosniff");
        }
        next.doFilter(request, response);
    }
}
