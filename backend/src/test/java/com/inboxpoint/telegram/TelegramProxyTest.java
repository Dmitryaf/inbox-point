package com.inboxpoint.telegram;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.time.Duration;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLServerSocket;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManagerFactory;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;

class TelegramProxyTest {
    private static final String TARGET = "telegram.synthetic.invalid";

    @TempDir
    Path directory;

    @Test
    void establishesTlsToTheProxyAndToTelegramInsideTheConnectTunnel() throws Exception {
        var tls = fixtureTls();
        try (var server = (SSLServerSocket) tls.getServerSocketFactory()
                .createServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            server.setSoTimeout(5000);
            var request = new FutureTask<>(() -> receiveTunnel(server, tls));
            Thread.ofVirtual().start(request);
            var proxy = URI.create("https://127.0.0.1:" + server.getLocalPort());
            try (var transport = TelegramHttpTransport.proxied(proxy, Duration.ofSeconds(3), tls)) {
                var api = new TelegramBotApi(transport, URI.create("https://" + TARGET), TelegramTestServer.TOKEN,
                        Duration.ofSeconds(3));
                assertThat(api.getUpdates(null, 1)).isEmpty();
                assertThat(request.get(5, TimeUnit.SECONDS)).isEqualTo("POST /bot" + TelegramTestServer.TOKEN + "/getUpdates HTTP/1.1");
            }
        }
    }

    private static String receiveTunnel(SSLServerSocket server, SSLContext tls) throws Exception {
        try (var outer = (SSLSocket) server.accept()) {
            outer.setSoTimeout(5000);
            var connect = new BufferedReader(new InputStreamReader(outer.getInputStream(), StandardCharsets.US_ASCII));
            assertThat(connect.readLine()).isEqualTo("CONNECT " + TARGET + ":443 HTTP/1.1");
            readHeaders(connect);
            outer.getOutputStream().write("HTTP/1.1 200 Connection established\r\n\r\n".getBytes(StandardCharsets.US_ASCII));
            outer.getOutputStream().flush();
            try (var inner = (SSLSocket) tls.getSocketFactory().createSocket(outer, TARGET, 443, false)) {
                inner.setUseClientMode(false);
                inner.startHandshake();
                var data = new BufferedReader(new InputStreamReader(inner.getInputStream(), StandardCharsets.UTF_8));
                var start = data.readLine();
                data.skip(readHeaders(data));
                var body = "{\"ok\":true,\"result\":[]}";
                var response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + body.length()
                        + "\r\nConnection: close\r\n\r\n" + body;
                inner.getOutputStream().write(response.getBytes(StandardCharsets.US_ASCII));
                inner.getOutputStream().flush();
                return start;
            }
        }
    }

    private static int readHeaders(BufferedReader stream) throws Exception {
        var length = 0;
        for (var line = stream.readLine(); line != null && !line.isEmpty(); line = stream.readLine()) {
            if (line.regionMatches(true, 0, "Content-Length:", 0, 15)) {
                length = Integer.parseInt(line.substring(15).strip());
            }
        }
        return length;
    }

    private SSLContext fixtureTls() throws Exception {
        var file = directory.resolve("proxy.p12");
        var password = "synthetic-proxy-fixture";
        var executable = System.getProperty("os.name").startsWith("Windows") ? "keytool.exe" : "keytool";
        var keytool = Path.of(System.getProperty("java.home"), "bin", executable).toString();
        var process = new ProcessBuilder(keytool, "-genkeypair", "-alias", "proxy", "-keyalg", "EC", "-validity", "2",
                "-keystore", file.toString(), "-storetype", "PKCS12", "-storepass", password, "-dname", "CN=Local proxy",
                "-ext", "SAN=IP:127.0.0.1,DNS:" + TARGET).redirectErrorStream(true).start();
        assertThat(process.waitFor(15, TimeUnit.SECONDS)).isTrue();
        assertThat(process.exitValue()).withFailMessage(new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8))
                .isZero();
        var store = KeyStore.getInstance("PKCS12");
        try (var input = Files.newInputStream(file)) {
            store.load(input, password.toCharArray());
        }
        var keys = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
        keys.init(store, password.toCharArray());
        var trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
        trust.init(store);
        var context = SSLContext.getInstance("TLS");
        context.init(keys.getKeyManagers(), trust.getTrustManagers(), null);
        return context;
    }
}
