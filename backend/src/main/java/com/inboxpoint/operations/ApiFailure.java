package com.inboxpoint.operations;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import javax.net.ssl.SSLException;

import com.fasterxml.jackson.annotation.JsonInclude;

public class ApiFailure extends IOException {
    private final Diagnostic diagnostic;

    public ApiFailure(String message, Diagnostic diagnostic) {
        super(message);
        this.diagnostic = diagnostic;
    }

    public Diagnostic diagnostic() {
        return diagnostic;
    }

    public static Diagnostic describe(String channel, String method, String kind, long started,
            Integer httpStatus, Integer apiCode, IOException transportFailure) {
        String code = switch (transportFailure) {
            case null -> null;
            case SocketTimeoutException ignored -> "ETIMEDOUT";
            case HttpTimeoutException ignored -> "ETIMEDOUT";
            case UnknownHostException ignored -> "ENOTFOUND";
            case ConnectException ignored -> "ECONNREFUSED";
            case SSLException ignored -> "TLS_FAILURE";
            default -> null;
        };
        return new Diagnostic(channel, method, kind, UUID.randomUUID().toString(),
                TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started), httpStatus, apiCode, code == null ? List.of() : List.of(code));
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Diagnostic(String channel, String method, String kind, String operationId, long durationMs,
            Integer httpStatus, Integer apiCode, List<String> transportCodes) { }
}
