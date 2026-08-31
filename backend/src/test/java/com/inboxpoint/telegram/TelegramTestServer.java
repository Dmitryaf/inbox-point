package com.inboxpoint.telegram;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class TelegramTestServer implements AutoCloseable {
    static final String TOKEN = "1:synthetic-test-token";
    private final HttpServer server;
    private final List<Request> requests = new ArrayList<>();

    TelegramTestServer(Function<Request, Response> handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/bot" + TOKEN + "/", exchange -> {
            try (exchange) {
                var request = new Request(exchange.getRequestMethod(), exchange.getRequestURI().getPath()
                        .substring(5 + TOKEN.length()),
                        JsonMapper.shared().readTree(exchange.getRequestBody()));
                synchronized (requests) {
                    requests.add(request);
                }
                var response = handler.apply(request);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                byte[] body = response.body().getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(response.status(), body.length);
                exchange.getResponseBody().write(body);
            }
        });
        server.start();
    }

    URI origin() {
        return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
    }

    List<Request> requests() {
        synchronized (requests) {
            return List.copyOf(requests);
        }
    }

    @Override
    public void close() {
        server.stop(0);
    }

    record Request(String verb, String method, JsonNode body) {
    }

    record Response(int status, String body) {
        static Response ok(String result) {
            return new Response(200, "{\"ok\":true,\"result\":" + result + "}");
        }

        static Response message(long id) {
            return ok("{\"message_id\":" + id + "}");
        }
    }
}
