package com.inboxpoint.vk;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

import com.inboxpoint.operations.ApiFailure;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

final class VkApiClient {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final String VERSION = "5.199";
    private static final Pattern COMMUNITY_ID = Pattern.compile("(?i)(?:club|public)?([0-9]+)");

    private final HttpClient client;
    private final URI origin;
    private final String token;
    private final Duration timeout;

    VkApiClient(HttpClient client, URI origin, String token, Duration timeout) {
        if (client.followRedirects() != HttpClient.Redirect.NEVER) {
            throw new IllegalArgumentException("VK transport must not follow redirects");
        }
        this.client = client;
        this.origin = origin;
        this.token = token;
        this.timeout = timeout;
    }

    void verifyReady(long groupId) throws IOException, InterruptedException {
        var settings = groupMethod("groups.getLongPollSettings", groupId);
        var events = settings.path("events");
        if (!flag(settings.path("is_enabled"))) {
            throw new IOException("VK Long Poll is disabled");
        }
        if (!flag(events.path("message_new"))) {
            throw new IOException("VK Long Poll message_new event is disabled");
        }
    }

    long resolveConfiguredCommunity(String reference) throws IOException, InterruptedException {
        var tokenPermissions = call("groups.getTokenPermissions", "");
        var permissions = tokenPermissions.path("permissions");
        if (!tokenPermissions.path("mask").isIntegralNumber() || tokenPermissions.path("mask").asLong() < 0
                || !permissions.isArray()) {
            throw invalid("groups.getTokenPermissions");
        }
        for (var required : List.of("manage", "messages")) {
            boolean allowed = false;
            for (var permission : permissions) {
                if (!permission.path("name").isString() || !permission.path("setting").isIntegralNumber()
                        || permission.path("setting").asLong() < 0) {
                    throw invalid("groups.getTokenPermissions");
                }
                allowed |= required.equals(permission.path("name").asString(""));
            }
            if (!allowed) {
                throw new IOException("VK access token is missing " + required + " permission");
            }
        }
        var clean = reference.strip().replaceFirst("/+$", "");
        var screenName = clean.substring(clean.lastIndexOf('/') + 1).split("\\?", 2)[0].strip();
        if (screenName.isEmpty()) {
            throw new IOException("VK community reference is invalid");
        }
        var numeric = COMMUNITY_ID.matcher(screenName);
        if (numeric.matches()) {
            try {
                var group = Long.parseLong(numeric.group(1));
                if (group > 0 && group < (1L << 53)) {
                    return group;
                }
            } catch (NumberFormatException invalid) {
                // The identifier must be a positive number supported by the VK contract.
            }
            throw new IOException("VK community reference is invalid");
        }
        var community = call("utils.resolveScreenName", "screen_name=" + encode(screenName));
        if (!"group".equals(community.path("type").asString(""))) {
            throw new IOException("VK reference does not point to a community");
        }
        var id = community.path("object_id");
        if (!id.isIntegralNumber() || !id.canConvertToLong() || id.longValue() <= 0 || id.longValue() >= (1L << 53)) {
            throw invalid("utils.resolveScreenName");
        }
        return id.longValue();
    }

    Server open(long groupId) throws IOException, InterruptedException {
        var result = groupMethod("groups.getLongPollServer", groupId);
        var key = result.path("key");
        var url = result.path("server");
        var cursor = cursor(result.path("ts"));
        if (!key.isString() || key.asString().isBlank() || !url.isString() || cursor == null) {
            throw invalid("groups.getLongPollServer");
        }
        return new Server(endpoint(url.asString()), key.asString(), cursor);
    }

    private JsonNode groupMethod(String method, long groupId) throws IOException, InterruptedException {
        var response = call(method, "group_id=" + groupId);
        if (!response.isObject()) {
            throw invalid(method);
        }
        return response;
    }

    String userDisplayName(long userId) throws IOException, InterruptedException {
        var result = call("users.get", "user_ids=" + userId);
        if (!result.isArray()) {
            throw invalid("users.get");
        }
        if (result.isEmpty()) {
            return "VK " + userId;
        }
        var user = result.path(0);
        var id = user.path("id");
        var first = user.path("first_name");
        var last = user.path("last_name");
        if (!id.isIntegralNumber() || !id.canConvertToLong() || id.longValue() != userId
                || !first.isString() || !last.isString()) {
            throw invalid("users.get");
        }
        var name = (first.asString() + " " + last.asString()).strip();
        return name.isEmpty() ? "VK " + userId
                : name.substring(0, name.offsetByCodePoints(0, Math.min(256, name.codePointCount(0, name.length()))));
    }

    String send(long peerId, String text, String idempotencyKey, JsonNode keyboard)
            throws IOException, InterruptedException {
        var body = "peer_id=" + peerId + "&message=" + encode(text) + "&random_id=" + randomId(idempotencyKey);
        JsonNode result;
        try {
            result = call("messages.send", keyboard == null ? body : body + "&keyboard=" + encode(keyboard.toString()));
        } catch (ApiError failure) {
            if (keyboard == null || keyboard.path("inline").booleanValue() || !failure.keyboardUnavailable()) {
                throw failure;
            }
            result = call("messages.send", body);
        }
        var id = result.isObject() ? result.path("message_id") : result;
        if (!id.isIntegralNumber() || !id.canConvertToLong() || id.longValue() < 0) {
            throw invalid("messages.send");
        }
        return id.asString();
    }

    private JsonNode call(String method, String parameters) throws IOException, InterruptedException {
        var started = System.nanoTime();
        var body = (parameters.isEmpty() ? "" : parameters + "&") + "access_token=" + encode(token) + "&v=" + VERSION;
        var request = HttpRequest.newBuilder(origin.resolve("/method/" + method))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .timeout(timeout).POST(HttpRequest.BodyPublishers.ofString(body)).build();
        var envelope = read(request, method);
        var errorCode = envelope.at("/error/error_code");
        if (errorCode.isIntegralNumber() && errorCode.canConvertToInt()) {
            throw new ApiError(method, errorCode.intValue(), started);
        }
        var response = envelope.path("response");
        if (response.isMissingNode() || response.isNull()) {
            throw invalid(method);
        }
        return response;
    }

    static byte[] sha256(String input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException failure) {
            throw new IllegalStateException("SHA-256 is unavailable", failure);
        }
    }

    static int randomId(String idempotencyKey) {
        var value = ByteBuffer.wrap(sha256(idempotencyKey)).order(ByteOrder.LITTLE_ENDIAN).getInt() & Integer.MAX_VALUE;
        return value == 0 ? 1 : value;
    }

    Result poll(Server server, String cursor, int waitSeconds) throws IOException, InterruptedException {
        var endpoint = server.endpoint();
        var parameters = "act=a_check&key=" + encode(server.key()) + "&ts=" + encode(cursor) + "&wait=" + waitSeconds;
        var request = HttpRequest.newBuilder(URI.create(endpoint + (endpoint.getRawQuery() == null ? "?" : "&")
                        + parameters)).timeout(timeout.plusSeconds(waitSeconds)).GET().build();
        var response = read(request, "Long Poll");
        var failure = response.path("failed");
        var nextCursor = cursor(response.path("ts"));
        if (failure.isIntegralNumber() && failure.canConvertToInt()) {
            return new Recovery(failure.intValue(), nextCursor);
        }
        var result = response.path("updates");
        if (nextCursor == null || !result.isArray()) {
            throw invalid("Long Poll");
        }
        var updates = new ArrayList<JsonNode>(result.size());
        for (var update : result) {
            if (!isEvent(update)) {
                throw invalid("Long Poll");
            }
            updates.add(update);
        }
        return new Batch(nextCursor, List.copyOf(updates));
    }

    static boolean isEvent(JsonNode update) {
        var eventId = update.path("event_id");
        var group = update.path("group_id");
        var type = update.path("type");
        return group.isIntegralNumber() && group.canConvertToLong() && group.longValue() > 0
                && type.isString() && !type.asString().isEmpty() && update.path("object").isObject()
                && (eventId.isMissingNode() || eventId.isString());
    }

    private URI endpoint(String raw) throws IOException {
        URI uri;
        try {
            uri = URI.create(raw);
        } catch (IllegalArgumentException failure) {
            throw invalid("Long Poll endpoint");
        }
        var sameHttpOrigin = "http".equalsIgnoreCase(uri.getScheme()) && "http".equalsIgnoreCase(origin.getScheme())
                && Objects.equals(uri.getRawAuthority(), origin.getRawAuthority());
        if ((!"https".equalsIgnoreCase(uri.getScheme()) && !sameHttpOrigin) || uri.getHost() == null
                || uri.getRawUserInfo() != null || uri.getRawFragment() != null) {
            throw invalid("Long Poll endpoint");
        }
        return uri;
    }

    private JsonNode read(HttpRequest request, String operation) throws IOException, InterruptedException {
        var started = System.nanoTime();
        HttpResponse<String> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException failure) {
            throw new ApiFailure("VK transport failed for " + operation,
                    ApiFailure.describe("vk", operation, "transport", started, null, null, failure));
        }
        var status = response.statusCode();
        if (status < 200 || status >= 300) {
            throw new ApiFailure("VK " + operation + " failed with HTTP " + status,
                    ApiFailure.describe("vk", operation, "http", started, status, null, null));
        }
        try {
            var result = JSON.readTree(response.body());
            if (result != null && result.isObject()) {
                return result;
            }
        } catch (JacksonException failure) {
            throw invalidResponse(operation, started, status);
        }
        throw invalidResponse(operation, started, status);
    }

    private static ApiFailure invalidResponse(String operation, long started, int status) {
        return new ApiFailure("Invalid VK response for " + operation,
                ApiFailure.describe("vk", operation, "invalid_response", started, status, null, null));
    }

    private static String cursor(JsonNode value) {
        if (value.isIntegralNumber()) {
            return value.asString();
        }
        return value.isString() && !value.asString().isBlank() ? value.asString() : null;
    }

    private static boolean flag(JsonNode value) throws IOException {
        if (value.isBoolean()) {
            return value.booleanValue();
        }
        if (value.isIntegralNumber() && value.canConvertToInt() && (value.intValue() == 0 || value.intValue() == 1)) {
            return value.intValue() == 1;
        }
        throw invalid("groups.getLongPollSettings");
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static IOException invalid(String operation) {
        return new IOException("Invalid VK response for " + operation);
    }

    record Server(URI endpoint, String key, String initialCursor) {
        @Override
        public String toString() {
            return "VK Long Poll server";
        }
    }

    sealed interface Result permits Batch, Recovery { }

    record Batch(String cursor, List<JsonNode> updates) implements Result { }

    record Recovery(int code, String cursor) implements Result { }

    static final class ApiError extends ApiFailure {
        private final int code;

        ApiError(String method, int code, long started) {
            super("VK " + method + " failed with code " + code,
                    ApiFailure.describe("vk", method, "api", started, 200, code, null));
            this.code = code;
        }

        boolean keyboardUnavailable() {
            return code == 911 || code == 912;
        }
    }
}
