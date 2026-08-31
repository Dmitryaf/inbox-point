package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import javax.net.ssl.SSLContext;

import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.ClientTlsStrategyBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.HttpHost;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.io.CloseMode;
import org.apache.hc.core5.util.Timeout;

public final class TelegramHttpTransport implements AutoCloseable {
    private final HttpClient direct;
    private final CloseableHttpClient proxied;

    private TelegramHttpTransport(HttpClient direct, CloseableHttpClient proxied) {
        this.direct = direct;
        this.proxied = proxied;
    }

    public static TelegramHttpTransport open(String proxyUrl, Duration timeout) {
        if (proxyUrl.isEmpty()) {
            return direct(HttpClient.newBuilder().connectTimeout(timeout).proxy(HttpClient.Builder.NO_PROXY).build());
        }
        return proxied(URI.create(proxyUrl), timeout, null);
    }

    static TelegramHttpTransport direct(HttpClient http) {
        if (http.followRedirects() != HttpClient.Redirect.NEVER) {
            throw new IllegalArgumentException("Telegram transport must not follow redirects");
        }
        return new TelegramHttpTransport(http, null);
    }

    static TelegramHttpTransport proxied(URI uri, Duration timeout, SSLContext ssl) {
        var scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if ((!"http".equals(scheme) && !"https".equals(scheme)) || uri.getHost() == null
                || uri.getRawUserInfo() != null || uri.getPort() == 0 || uri.getPort() > 65_535) {
            throw new IllegalArgumentException("Invalid Telegram proxy configuration");
        }
        var connectionTimeout = Timeout.of(timeout);
        var manager = PoolingHttpClientConnectionManagerBuilder.create()
                .setDefaultConnectionConfig(ConnectionConfig.custom().setConnectTimeout(connectionTimeout).build());
        if (ssl != null) {
            manager.setTlsSocketStrategy(ClientTlsStrategyBuilder.create().setSslContext(ssl).buildClassic());
        }
        var http = HttpClients.custom().setConnectionManager(manager.build())
                .setProxy(new HttpHost(scheme, uri.getHost(), uri.getPort()))
                .disableAutomaticRetries().disableRedirectHandling().disableCookieManagement().build();
        return new TelegramHttpTransport(null, http);
    }

    Reply post(URI uri, String payload, Duration timeout) throws IOException, InterruptedException {
        if (Thread.currentThread().isInterrupted()) {
            throw new InterruptedException();
        }
        if (direct != null) {
            var request = HttpRequest.newBuilder(uri).timeout(timeout).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload)).build();
            var reply = direct.send(request, HttpResponse.BodyHandlers.ofString());
            return new Reply(reply.statusCode(), reply.body());
        }

        var request = new HttpPost(uri);
        request.setEntity(new StringEntity(payload, ContentType.APPLICATION_JSON));
        var requestTimeout = Timeout.of(timeout);
        request.setConfig(RequestConfig.custom().setConnectionRequestTimeout(requestTimeout)
                .setResponseTimeout(requestTimeout).build());
        try {
            return proxied.execute(request, reply -> new Reply(reply.getCode(), reply.getEntity() == null ? ""
                    : EntityUtils.toString(reply.getEntity(), StandardCharsets.UTF_8)));
        } catch (IOException failure) {
            if (Thread.currentThread().isInterrupted()) {
                throw new InterruptedException();
            }
            throw failure;
        }
    }

    @Override
    public void close() {
        if (direct != null) {
            direct.close();
        } else {
            proxied.close(CloseMode.IMMEDIATE);
        }
    }

    record Reply(int statusCode, String body) { }
}
