package com.inboxpoint.admin;

import java.net.InetAddress;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

import jakarta.servlet.http.HttpServletRequest;

final class AdminRequestOrigin {
    private static final InetAddress IPV4_LOOPBACK = InetAddress.ofLiteral("127.0.0.1");
    private static final InetAddress IPV6_LOOPBACK = InetAddress.ofLiteral("::1");
    private final List<Network> trusted;

    AdminRequestOrigin(String proxyConfig) {
        var networks = new ArrayList<>(List.of(new Network(IPV4_LOOPBACK, 32), new Network(IPV6_LOOPBACK, 128)));
        if (!proxyConfig.isEmpty()) {
            for (String text : proxyConfig.split(",", -1)) {
                var parts = text.strip().split("/", -1);
                var address = InetAddress.ofLiteral(parts[0]);
                var width = address.getAddress().length * Byte.SIZE;
                var prefix = parts.length == 1 ? width : Integer.parseInt(parts[1]);
                if (parts.length > 2 || prefix < 0 || prefix > width) {
                    throw new IllegalArgumentException("Invalid HTTP_TRUSTED_PROXIES entry");
                }
                networks.add(new Network(address, prefix));
            }
        }
        trusted = List.copyOf(networks);
    }

    Origin inspect(HttpServletRequest request) {
        var remote = InetAddress.ofLiteral(request.getRemoteAddr());
        var peer = remote;
        var scheme = request.getScheme();
        var authority = request.getHeader("Host");
        var valid = true;
        if (trusted(remote)) {
            var hops = forwarded(request, "X-Forwarded-For");
            try {
                for (int index = hops.size() - 1; index >= 0 && trusted(peer); index--) {
                    peer = InetAddress.ofLiteral(hops.get(index));
                }
            } catch (IllegalArgumentException malformed) {
                valid = false;
            }
            scheme = lastHeader(request, "X-Forwarded-Proto", scheme);
            authority = lastHeader(request, "X-Forwarded-Host", authority);
        }
        return new Origin(peer.getHostAddress(), valid && (IPV4_LOOPBACK.equals(peer) || IPV6_LOOPBACK.equals(peer)),
                valid ? origin(scheme + "://" + authority) : null);
    }

    static boolean sameOrigin(HttpServletRequest request, Origin destination) {
        var headers = request.getHeaders("Origin");
        if (!headers.hasMoreElements()) {
            return true;
        }
        var source = origin(headers.nextElement());
        return !headers.hasMoreElements() && source != null && source.equals(destination.site());
    }

    private boolean trusted(InetAddress address) {
        return trusted.stream().anyMatch(network -> network.contains(address));
    }

    private static String lastHeader(HttpServletRequest request, String name, String fallback) {
        var values = forwarded(request, name);
        return values.isEmpty() ? fallback : values.getLast();
    }

    private static List<String> forwarded(HttpServletRequest request, String name) {
        var result = new ArrayList<String>();
        var headers = request.getHeaders(name);
        while (headers.hasMoreElements()) {
            Arrays.stream(headers.nextElement().split(",", -1)).map(String::strip).forEach(result::add);
        }
        return result;
    }

    private static Site origin(String raw) {
        try {
            var uri = URI.create(raw);
            var scheme = uri.getScheme();
            if (uri.getHost() == null || uri.getRawUserInfo() != null || uri.getPort() > 65_535
                    || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                return null;
            }
            int port = uri.getPort() >= 0 ? uri.getPort() : "https".equalsIgnoreCase(scheme) ? 443 : 80;
            return new Site(scheme.toLowerCase(Locale.ROOT), uri.getHost().toLowerCase(Locale.ROOT), port);
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }

    record Origin(String client, boolean loopback, Site site) {
        String baseUrl() {
            if (site == null) {
                return "";
            }
            int defaultPort = site.scheme.equals("https") ? 443 : 80;
            return site.scheme + "://" + site.host + (site.port == defaultPort ? "" : ":" + site.port);
        }
    }

    private record Site(String scheme, String host, int port) { }

    private record Network(InetAddress address, int prefix) {
        boolean contains(InetAddress ip) {
            var network = address.getAddress();
            var candidate = ip.getAddress();
            if (network.length != candidate.length) {
                return false;
            }
            int fullBytes = prefix / Byte.SIZE;
            if (!Arrays.equals(network, 0, fullBytes, candidate, 0, fullBytes)) {
                return false;
            }
            int remaining = prefix % Byte.SIZE;
            int mask = 0xff << (Byte.SIZE - remaining);
            return remaining == 0 || ((network[fullBytes] ^ candidate[fullBytes]) & mask) == 0;
        }
    }
}
