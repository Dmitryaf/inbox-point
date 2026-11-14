package com.inboxpoint.admin;

import java.io.IOException;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.sql.SQLException;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.databind.json.JsonMapper;

@Configuration(proxyBeanMethods = false)
class AdminAccess implements WebMvcConfigurer, HandlerInterceptor {
    private static final String ATTRIBUTE = AdminAccess.class.getName();
    private final AdminSessions sessions;
    private final AdminRequestOrigin origins;

    AdminAccess(AdminSessions sessions, Environment environment) {
        this.sessions = sessions;
        this.origins = new AdminRequestOrigin(environment.getProperty("HTTP_TRUSTED_PROXIES", ""));
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(this).addPathPatterns("/api/admin/**", "/api/manage/**", "/api/setup/**", "/api/ops/**",
                "/api/analytics");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        privateResponse(response);
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }
        var origin = origins.inspect(request);
        var bypass = localBypass(origin);
        if (!sessions.configured() && !bypass) {
            return error(response, 404, "Not found");
        }

        var token = token(request);
        var availableWithoutSession = method.getMethodAnnotation(AvailableWithoutSession.class);
        boolean authenticated = bypass;
        try {
            if (availableWithoutSession == null || availableWithoutSession.reportAuthentication()) {
                authenticated = bypass || sessions.authenticate(token);
            }
        } catch (SQLException unavailable) {
            return error(response, 503, "Не удалось проверить сессию. Попробуйте позже.");
        }
        if (availableWithoutSession == null && !authenticated) {
            return error(response, 401, "Войдите, чтобы продолжить.");
        }
        if (!"GET".equals(request.getMethod()) && !"HEAD".equals(request.getMethod())
                && !AdminRequestOrigin.sameOrigin(request, origin)) {
            return error(response, 403, "Запрос отклонён.");
        }
        request.setAttribute(ATTRIBUTE, new Context(origin.client(), token, bypass, authenticated));
        return true;
    }

    String frontendOrigin(HttpServletRequest request) {
        var origin = origins.inspect(request);
        return sessions.configured() || localBypass(origin) ? origin.baseUrl() : null;
    }

    private boolean localBypass(AdminRequestOrigin.Origin origin) {
        return !sessions.configured() && !sessions.secure() && origin.loopback();
    }

    static void privateResponse(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
    }

    String cookie(String token, long seconds) {
        return cookieName() + "=" + token + "; Path=/; Max-Age=" + seconds + "; HttpOnly; SameSite=Strict"
                + (sessions.secure() ? "; Secure" : "");
    }

    private String cookieName() {
        return (sessions.secure() ? "__Host-" : "") + "inbox-point-admin-session";
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

    static Context context(HttpServletRequest request) {
        return (Context) request.getAttribute(ATTRIBUTE);
    }

    private static boolean error(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        JsonMapper.shared().writeValue(response.getOutputStream(), Map.of("message", message));
        return false;
    }

    @Target(ElementType.METHOD)
    @Retention(RetentionPolicy.RUNTIME)
    @interface AvailableWithoutSession {
        boolean reportAuthentication() default false;
    }

    record Context(String client, String token, boolean bypass, boolean authenticated) { }
}
