package com.inboxpoint.telegram;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.inboxpoint.persistence.LegacySqlite;
import com.inboxpoint.persistence.SqliteTextHandoff;
import com.inboxpoint.vk.VkLongPoll;
import com.inboxpoint.vk.VkTextHandoff;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class VkTelegramBridgeTest {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-01T10:03:00Z"), ZoneOffset.UTC);
    private static final Duration TIMEOUT = Duration.ofSeconds(3);
    private static final long OPERATOR = -100123;
    private static final long PEER = 701;

    @TempDir
    Path directory;

    @Test
    void repliesToTheVkCustomerAndMirrorsManualRepliesWithoutEchoingThem() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        Files.writeString(directory.resolve("content-settings.json"), """
                {"formatVersion":3,"history":[],"content":{"faq":[
                  {"question":"Что взять?","answer":"Удобную одежду."}]}}
                """);
        var topic = new AtomicInteger(41);
        var telegramUpdates = new AtomicReference<>(telegramCustomer());
        try (var telegram = new TelegramTestServer(request -> switch (request.method()) {
                case "getUpdates" -> TelegramTestServer.Response.ok(telegramUpdates.get());
                case "getMe" -> TelegramTestServer.Response.ok("{\"id\":501,\"is_bot\":true}");
                case "getChat" -> TelegramTestServer.Response.ok("{\"id\":-100123,\"type\":\"supergroup\",\"is_forum\":true}");
                case "getChatMember" -> TelegramTestServer.Response.ok("{\"status\":\"administrator\",\"can_manage_topics\":true}");
                case "getWebhookInfo" -> TelegramTestServer.Response.ok("{\"url\":\"\"}");
                case "createForumTopic" -> TelegramTestServer.Response.ok(
                        "{\"message_thread_id\":" + topic.incrementAndGet() + "}");
                case "sendMessage" -> TelegramTestServer.Response.message(77);
                default -> throw new AssertionError(request.method());
            }); var vk = new VkFixture(); var http = HttpClient.newHttpClient();
                var operator = TelegramTextHandoff.openVerified(database,
                        new TelegramBotApi(http, telegram.origin(), TelegramTestServer.TOKEN, TIMEOUT), OPERATOR, CLOCK);
                var store = SqliteTextHandoff.open(database, CLOCK.instant())) {
            var channel = connect(database, store, http, vk, operator);
            assertThat(scalar(database, "SELECT identity FROM channel_connection_identities WHERE channel = 'telegram'"))
                    .isEqualTo("501:-100123");
            runTelegram(operator);
            var faq = vkMessage("faq", 7, "Частые вопросы", "faq", false, false);
            var question = vkMessage("question", 8, "Вопрос из VK", null, false, false);
            runVk(channel, vk, faq, question);
            assertThat(vk.sent).extracting(call -> call.get("message"))
                    .satisfiesExactly(text -> assertThat(text).contains("Удобную одежду"),
                            text -> assertThat(text).startsWith("Вопрос отправлен."));
            assertThat(JSON.readTree(vk.sent.getFirst().get("keyboard")).at("/buttons/0/0/action/payload").asString())
                    .contains("faq");
            assertThat(scalar(database, "SELECT count(*) FROM support_requests WHERE external_conversation_id = '701'"))
                    .isEqualTo("2");
            assertThat(telegram.requests()).filteredOn(call -> call.method().equals("createForumTopic"))
                    .extracting(call -> call.body().path("name").asString()).containsExactly("TG - Telegram", "VK - VK Customer");

            telegramUpdates.set(telegramReply(105, 43, "Ответ в VK"));
            runTelegram(operator);
            channel.sendPending();
            assertThat(vk.sent.getLast()).containsEntry("peer_id", Long.toString(PEER))
                    .containsEntry("message", "Ответ в VK").containsEntry("random_id", "589200093");
            assertThat(telegram.requests()).noneMatch(call -> call.body().path("text").asString("").equals("Ответ в VK"));
            assertThat(scalar(database, "SELECT status || ':' || channel FROM deliveries WHERE idempotency_key = 'operator:105'"))
                    .isEqualTo("sent:vk");

            var nativeReply = vkMessage("native", 9, "Написано в VK вручную", null, true, true);
            var echo = vkMessage("api-echo", 10, "Автоматический ответ", null, true, false);
            runVk(channel, vk, nativeReply, echo);
            runVk(connect(database, store, http, vk, operator), vk, faq, question, nativeReply, echo);
            runTelegram(operator);
            assertThat(vk.sent).hasSize(3);
            assertThat(telegram.requests()).filteredOn(call -> call.body().path("text").asString("").contains("Написано в VK вручную"))
                    .singleElement().satisfies(call -> assertThat(call.body().path("message_thread_id").asLong()).isEqualTo(43));
            assertThat(scalar(database, "SELECT count(*) FROM operator_actions WHERE kind = 'mirror_operator_message' AND status = 'sent'"))
                    .isEqualTo("1");
        }
    }

    @Test
    void resumesWebRecoveryAfterRestartAndKeepsOperatorOwnedRequestsInTheBrowser() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        var rejectSecond = new AtomicInteger();
        var now = CLOCK.instant();
        try (var telegram = new TelegramTestServer(call -> switch (call.method()) {
                case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":42}");
                case "sendMessage" -> {
                    var body = call.body().path("text").asString();
                    if (body.contains("Второй вопрос") && rejectSecond.getAndIncrement() == 0) {
                        yield new TelegramTestServer.Response(429,
                                "{\"ok\":false,\"error_code\":429,\"description\":\"Retry later\"}");
                    }
                    yield TelegramTestServer.Response.message(body.contains("Первый вопрос") ? 91 : 92);
                }
                default -> throw new AssertionError(call.method());
            }); var http = HttpClient.newHttpClient()) {
            var api = new TelegramBotApi(http, telegram.origin(), TelegramTestServer.TOKEN, TIMEOUT);
            try (var store = SqliteTextHandoff.open(database, now)) {
                store.acceptClientTextInWeb(new SqliteTextHandoff.ClientText("vk", "event1", "701", "1",
                        "Клиент", "Первый вопрос", now), now);
                store.acceptClientTextInWeb(new SqliteTextHandoff.ClientText("vk", "event2", "701", "2",
                        "Клиент", "Второй вопрос", now.plusSeconds(1)), now.plusSeconds(1));
                store.acceptClientTextInWeb(new SqliteTextHandoff.ClientText("vk", "event3", "702", "3",
                        "Администратор ведёт в вебе", "Вопрос в веб-ящике", now), now);
                var pinned = scalar(database, "SELECT id FROM support_requests WHERE external_conversation_id = '702'");
                assertThat(store.replyFromWeb(pinned, "operator-reply", "Ответ в вебе", now))
                        .isEqualTo(SqliteTextHandoff.WebActionResult.ACCEPTED);
            }
            try (var operator = TelegramTextHandoff.open(database, api, OPERATOR, CLOCK)) {
                operator.recoverWebRequests();
                assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE external_conversation_id = '701'"))
                        .startsWith("web:");
            }
            try (var operator = TelegramTextHandoff.open(database, api, OPERATOR, CLOCK)) {
                operator.recoverWebRequests();
                operator.recoverWebRequests();
            }
            assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE external_conversation_id = '701'"))
                    .isEqualTo("42");
            assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE external_conversation_id = '702'"))
                    .startsWith("web:");
            assertThat(telegram.requests()).filteredOn(call -> call.method().equals("createForumTopic")).hasSize(1);
            assertThat(telegram.requests()).filteredOn(call -> call.body().path("text").asString("").contains("Первый вопрос"))
                    .hasSize(1);
            assertThat(telegram.requests()).filteredOn(call -> call.body().path("text").asString("").contains("Второй вопрос"))
                    .hasSize(2);
            assertThat(scalar(database, "SELECT COUNT(*) FROM deliveries WHERE id LIKE 'system:handoff-recovered:%'"))
                    .isEqualTo("1");
        }
    }

    @Test
    void restoresADeletedTopicAndResumesTheHistoryAfterRestartWithoutDuplicatingMessages() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        var nextTopic = new AtomicInteger(41);
        var replyId = new AtomicInteger(76);
        var partial = new AtomicInteger();
        var updates = new AtomicReference<>("[]");
        try (var telegram = new TelegramTestServer(call -> switch (call.method()) {
                case "getUpdates" -> TelegramTestServer.Response.ok(updates.get());
                case "createForumTopic" -> TelegramTestServer.Response.ok("{\"message_thread_id\":" + nextTopic.incrementAndGet() + "}");
                case "sendMessage" -> {
                    var thread = call.body().path("message_thread_id").asInt();
                    var content = call.body().path("text").asString();
                    if (thread == 42 && content.contains("Ручной ответ")) {
                        yield new TelegramTestServer.Response(400,
                                "{\"ok\":false,\"error_code\":400,\"description\":\"Bad Request: message thread not found\"}");
                    }
                    if (thread == 43 && content.contains("Второй вопрос") && partial.getAndIncrement() == 0) {
                        yield new TelegramTestServer.Response(429,
                                "{\"ok\":false,\"error_code\":429,\"description\":\"Retry later\"}");
                    }
                    yield TelegramTestServer.Response.message(replyId.incrementAndGet());
                }
                default -> throw new AssertionError(call.method());
            }); var vk = new VkFixture(); var http = HttpClient.newHttpClient()) {
            var api = new TelegramBotApi(http, telegram.origin(), TelegramTestServer.TOKEN, TIMEOUT);
            var nativeReply = vkMessage("native", 10, "Ручной ответ", null, true, true);
            try (var operator = TelegramTextHandoff.open(database, api, OPERATOR, CLOCK);
                    var store = SqliteTextHandoff.openExisting(database)) {
                var channel = connect(database, store, http, vk, operator);
                runVk(channel, vk, vkMessage("first", 8, "Первый вопрос", null, false, false),
                        vkMessage("second", 9, "Второй вопрос", null, false, false));
                vk.updates.set("{\"ts\":102,\"updates\":[" + nativeReply + "]}");
                assertThat(channel.step(1)).isEqualTo(VkLongPoll.Step.POLLED);
                assertThat(channel.step(1)).isEqualTo(VkLongPoll.Step.EVENT_FAILED);
                assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE channel = 'vk'"))
                        .isEqualTo("43");
            }

            var later = Clock.offset(CLOCK, Duration.ofSeconds(3));
            try (var operator = TelegramTextHandoff.open(database, api, OPERATOR, later);
                    var store = SqliteTextHandoff.openExisting(database)) {
                var channel = new VkTextHandoff(database, store, http, vk.origin(), "synthetic-token", 48, TIMEOUT,
                        operator, later);
                assertThat(channel.step(1)).isEqualTo(VkLongPoll.Step.PROCESSED);
                runVk(channel, vk, nativeReply);
                updates.set(telegramReply(106, 42, "Ответ из старой темы"));
                runTelegram(operator);
                updates.set(telegramReply(107, 43, "Ответ из новой темы"));
                runTelegram(operator);
                channel.sendPending();
            }
            assertThat(telegram.requests()).filteredOn(call -> call.method().equals("createForumTopic")).hasSize(2);
            assertThat(telegram.requests()).filteredOn(call -> call.method().equals("sendMessage")
                    && call.body().path("message_thread_id").asInt() == 43)
                    .extracting(call -> call.body().path("text").asString())
                    .satisfiesExactly(first -> assertThat(first).contains("Первый вопрос"),
                            second -> assertThat(second).contains("Второй вопрос"),
                            retry -> assertThat(retry).contains("Второй вопрос"),
                            reply -> assertThat(reply).contains("Ручной ответ"));
            assertThat(scalar(database, "SELECT count(*) FROM conversation_messages WHERE external_message_id = '701:10'"))
                    .isEqualTo("1");
            assertThat(vk.sent).extracting(call -> call.get("message"))
                    .contains("Ответ из новой темы").doesNotContain("Ответ из старой темы", "Ручной ответ");
        }
    }

    @Test
    void doesNotAutomaticallyCreateAnotherTopicWhenTheReplacementResultIsUnknown() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        var creates = new AtomicInteger();
        try (var telegram = new TelegramTestServer(call -> switch (call.method()) {
                case "createForumTopic" -> creates.incrementAndGet() == 1
                        ? TelegramTestServer.Response.ok("{\"message_thread_id\":42}") : TelegramTestServer.Response.ok("{}");
                case "sendMessage" -> call.body().path("text").asString().contains("Ручной ответ")
                        ? new TelegramTestServer.Response(400,
                                "{\"ok\":false,\"error_code\":400,\"description\":\"TOPIC_CLOSED\"}")
                        : TelegramTestServer.Response.message(77);
                default -> throw new AssertionError(call.method());
            }); var vk = new VkFixture(); var http = HttpClient.newHttpClient()) {
            var api = new TelegramBotApi(http, telegram.origin(), TelegramTestServer.TOKEN, TIMEOUT);
            try (var operator = TelegramTextHandoff.open(database, api, OPERATOR, CLOCK);
                    var store = SqliteTextHandoff.openExisting(database)) {
                var channel = connect(database, store, http, vk, operator);
                runVk(channel, vk, vkMessage("first", 8, "Первый вопрос", null, false, false));
                var reply = vkMessage("native", 10, "Ручной ответ", null, true, true);
                vk.updates.set("{\"ts\":102,\"updates\":[" + reply + "]}");
                assertThat(channel.step(1)).isEqualTo(VkLongPoll.Step.POLLED);
                assertThat(channel.step(1)).isEqualTo(VkLongPoll.Step.EVENT_FAILED);
            }
            var later = Clock.offset(CLOCK, Duration.ofSeconds(3));
            try (var operator = TelegramTextHandoff.open(database, api, OPERATOR, later);
                    var store = SqliteTextHandoff.openExisting(database)) {
                var channel = new VkTextHandoff(database, store, http, vk.origin(), "synthetic-token", 48, TIMEOUT,
                        operator, later);
                assertThat(channel.step(1)).isEqualTo(VkLongPoll.Step.EVENT_FAILED);
            }
            assertThat(creates.get()).isEqualTo(2);
            assertThat(scalar(database, "SELECT status FROM operator_actions WHERE id LIKE 'operator-open-replacement:%'"))
                    .isEqualTo("outcome_unknown");
            assertThat(scalar(database, "SELECT operator_topic_id FROM support_requests WHERE channel = 'vk'"))
                    .isEqualTo("42");
        }
    }

    @Test
    void sendsAWebReplyToVkWithTheExistingIdempotencyKeyAfterAnExplicitRetry() throws Exception {
        var database = directory.resolve("inbox.sqlite");
        try (var vk = new VkFixture(); var http = HttpClient.newHttpClient();
                var store = SqliteTextHandoff.open(database, CLOCK.instant())) {
            var channel = connect(database, store, http, vk, null);
            runVk(channel, vk, vkMessage("question", 8, "Вопрос из VK", null, false, false));
            var request = scalar(database, "SELECT id FROM support_requests WHERE channel = 'vk'");
            assertThat(store.replyFromWeb(request, "fixture", "Ответ из web-inbox", CLOCK.instant()))
                    .isEqualTo(SqliteTextHandoff.WebActionResult.ACCEPTED);
            var control = directory.resolve("service-control.json");
            var service = """
                    {"channels":{"telegram":{"mode":"active"},"vk":{"mode":"active"}},"delivery":{"mode":"%s"}}
                    """;
            Files.writeString(control, service.formatted("paused"));
            channel.sendPending();
            assertThat(vk.sent).hasSize(1);
            Files.writeString(control, service.formatted("active"));
            vk.nextSend.set("{}");
            channel.sendPending();
            var delivery = scalar(database, "SELECT id FROM deliveries WHERE outcome_unknown = 1");
            assertThat(scalar(database, "SELECT status FROM deliveries WHERE outcome_unknown = 1")).isEqualTo("failed");
            channel.sendPending();
            assertThat(vk.sent).hasSize(2);
            assertThat(store.confirmDeliveryNotReceived(delivery, CLOCK.instant())).isTrue();
            channel.sendPending();
            assertThat(vk.sent.subList(1, 3)).extracting(call -> call.get("random_id"))
                    .containsOnly(vk.sent.get(1).get("random_id"));
            assertThat(scalar(database, "SELECT status FROM deliveries WHERE text = 'Ответ из web-inbox'")).isEqualTo("sent");
        }
    }

    private static VkTextHandoff connect(Path db, SqliteTextHandoff store, HttpClient http, VkFixture vk,
            TelegramTextHandoff operator) throws Exception {
        return new VkTextHandoff(db, store, http, vk.origin(), "synthetic-token", 48, TIMEOUT, operator, CLOCK);
    }

    private static void runTelegram(TelegramTextHandoff operator) throws Exception {
        operator.poll(1);
        while (operator.processNext()) {
            // Drain events retained by the Telegram poller.
        }
        operator.sendPending();
    }

    private static void runVk(VkTextHandoff runtime, VkFixture vk, String... events) throws Exception {
        vk.updates.set("{\"ts\":" + vk.cursor.incrementAndGet() + ",\"updates\":[" + String.join(",", events) + "]}");
        assertThat(runtime.step(1)).isEqualTo(VkLongPoll.Step.POLLED);
        for (var ignored : events) {
            assertThat(runtime.step(1)).isEqualTo(VkLongPoll.Step.PROCESSED);
        }
        runtime.sendPending();
    }

    private static String vkMessage(String event, int messageId, String text, String action, boolean reply, boolean manual) {
        var update = JSON.createObjectNode().put("type", reply ? "message_reply" : "message_new")
                .put("group_id", 48).put("event_id", event);
        var message = update.putObject("object");
        if (!reply) {
            message = message.putObject("message");
        }
        message.put("peer_id", PEER).put("from_id", reply ? -48 : PEER).put("id", messageId)
                .put("conversation_message_id", messageId).put("date", CLOCK.instant().getEpochSecond())
                .put("out", reply ? 1 : 0).put("text", text);
        if (action != null) {
            message.put("payload", JSON.createObjectNode().put("action", action).toString());
        }
        if (manual) {
            message.put("admin_author_id", 91);
        }
        return update.toString();
    }

    private static String telegramCustomer() {
        return """
                [{"update_id":104,"message":{"message_id":5,"chat":{"id":701,"type":"private"},
                  "from":{"id":701,"first_name":"Telegram","is_bot":false},"date":%d,"text":"Другой клиент"}}]
                """.formatted(CLOCK.instant().getEpochSecond());
    }

    private static String telegramReply(long update, long topic, String text) {
        return """
                [{"update_id":%d,"message":{"message_id":88,"message_thread_id":%d,"is_topic_message":true,
                  "chat":{"id":%d,"type":"supergroup"},"from":{"id":99,"is_bot":false},"date":%d,"text":"%s"}}]
                """.formatted(update, topic, OPERATOR, CLOCK.instant().getEpochSecond() + 1, text);
    }

    private static String scalar(Path database, String query) throws Exception {
        try (var connection = LegacySqlite.connect(database); var statement = connection.createStatement();
                var rows = statement.executeQuery(query)) {
            assertThat(rows.next()).isTrue();
            return rows.getString(1);
        }
    }

    private static final class VkFixture implements AutoCloseable {
        private final HttpServer server;
        private final AtomicReference<String> updates = new AtomicReference<>();
        private final AtomicReference<String> nextSend = new AtomicReference<>("{\"response\":900}");
        private final AtomicInteger cursor = new AtomicInteger(100);
        private final List<Map<String, String>> sent = new CopyOnWriteArrayList<>();

        private VkFixture() throws Exception {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                try (exchange) {
                    var body = switch (exchange.getRequestURI().getPath()) {
                        case "/method/groups.getLongPollSettings" -> """
                                {"response":{"is_enabled":true,"events":{"message_new":true,"message_reply":true}}}
                                """;
                        case "/method/groups.getLongPollServer" -> """
                                {"response":{"key":"key","server":"%s/poll","ts":"100"}}
                                """.formatted(origin());
                        case "/method/users.get" -> "{\"response\":[{\"id\":701,\"first_name\":\"VK\",\"last_name\":\"Customer\"}]}";
                        case "/poll" -> updates.get();
                        case "/method/messages.send" -> {
                            var form = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
                            var parameters = new LinkedHashMap<String, String>();
                            for (var parameter : form.split("&")) {
                                var entry = parameter.split("=", 2);
                                parameters.put(entry[0], URLDecoder.decode(entry[1], StandardCharsets.UTF_8));
                            }
                            sent.add(parameters);
                            yield nextSend.getAndSet("{\"response\":900}");
                        }
                        default -> throw new AssertionError(exchange.getRequestURI().getPath());
                    };
                    var bytes = body.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(200, bytes.length);
                    exchange.getResponseBody().write(bytes);
                }
            });
            server.start();
        }

        private URI origin() {
            return URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        }

        @Override
        public void close() {
            server.stop(0);
        }
    }
}
