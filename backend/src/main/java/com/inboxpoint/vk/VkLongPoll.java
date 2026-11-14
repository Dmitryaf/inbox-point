package com.inboxpoint.vk;

import java.io.IOException;
import java.sql.SQLException;
import java.time.Clock;
import java.util.HexFormat;
import java.util.List;

import com.inboxpoint.persistence.SqliteTextHandoff;
import com.inboxpoint.persistence.SqliteTextHandoff.IncomingUpdate;
import com.inboxpoint.persistence.SqliteTextHandoff.PendingUpdate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class VkLongPoll {
    private static final String SOURCE = "vk:long-poll";
    private static final JsonMapper JSON = JsonMapper.shared();

    private final SqliteTextHandoff store;
    private final VkApiClient gateway;
    private final long groupId;
    private final EventHandler handler;
    private final Clock clock;
    private VkApiClient.Server server;

    static VkLongPoll connect(SqliteTextHandoff store, VkApiClient gateway, long groupId, EventHandler handler,
            Clock clock) throws IOException, SQLException, InterruptedException {
        gateway.verifyReady(groupId);
        var server = gateway.open(groupId);
        return switch (store.claimChannelIdentity("vk", Long.toString(groupId))) {
            case ACCEPTED -> new VkLongPoll(store, gateway, groupId, handler, clock, server);
            case CONFLICT -> throw new IOException("VK connection identity conflicts with the existing history");
            case LEGACY_UNBOUND -> throw new IOException("VK history requires confirmation of the existing identity");
        };
    }

    private VkLongPoll(SqliteTextHandoff store, VkApiClient gateway, long groupId, EventHandler handler, Clock clock,
            VkApiClient.Server server) {
        this.store = store;
        this.gateway = gateway;
        this.groupId = groupId;
        this.handler = handler;
        this.clock = clock;
        this.server = server;
    }

    Step step(int waitSeconds) throws SQLException, IOException, InterruptedException {
        var pending = store.pendingUpdate(SOURCE);
        if (pending.isPresent()) {
            return process(pending.get());
        }
        return poll(store, waitSeconds);
    }

    boolean processNext() throws SQLException, InterruptedException {
        var pending = store.pendingUpdate(SOURCE);
        return pending.isPresent() && process(pending.get()) != Step.WAITING_FOR_RETRY;
    }

    Step poll(SqliteTextHandoff inbox, int waitSeconds) throws SQLException, IOException, InterruptedException {
        if (inbox.pendingUpdate(SOURCE).isPresent()) {
            return Step.DRAINING;
        }
        var stored = inbox.cursor(SOURCE);
        var cursor = stored.orElse(server.initialCursor());
        if (stored.isEmpty()) {
            inbox.saveUpdates(SOURCE, List.of(), cursor, clock.instant());
        }
        return switch (gateway.poll(server, cursor, waitSeconds)) {
            case VkApiClient.Batch batch -> {
                var updates = batch.updates().stream().map(VkLongPoll::queuedUpdate).toList();
                inbox.saveUpdates(SOURCE, updates, batch.cursor(), clock.instant());
                yield Step.POLLED;
            }
            case VkApiClient.Recovery failure -> recover(inbox, failure);
        };
    }

    private Step recover(SqliteTextHandoff inbox, VkApiClient.Recovery failure)
            throws SQLException, IOException, InterruptedException {
        return switch (failure.code()) {
            case 1 -> {
                if (failure.cursor() == null) {
                    throw new IOException("VK Long Poll recovery did not include a replacement cursor");
                }
                inbox.saveUpdates(SOURCE, List.of(), failure.cursor(), clock.instant());
                yield Step.HISTORY_EXPIRED;
            }
            case 2 -> {
                server = gateway.open(groupId);
                yield Step.KEY_REFRESHED;
            }
            case 3 -> {
                var refreshed = gateway.open(groupId);
                inbox.saveUpdates(SOURCE, List.of(), refreshed.initialCursor(), clock.instant());
                server = refreshed;
                yield Step.HISTORY_EXPIRED;
            }
            default -> throw new IOException("VK Long Poll returned an unsupported recovery response");
        };
    }

    private Step process(PendingUpdate pending) throws SQLException, InterruptedException {
        var now = clock.instant();
        if (pending.retryAt() != null && pending.retryAt().isAfter(now)) {
            return Step.WAITING_FOR_RETRY;
        }
        try {
            var event = JSON.readTree(pending.payload());
            if (event == null || !VkApiClient.isEvent(event)) {
                return discard(pending, "Stored VK event is invalid");
            }
            if (event.path("group_id").longValue() != groupId) {
                return discard(pending, "Stored VK event belongs to a different community");
            }
            handler.route(event);
            store.completeUpdate(SOURCE, pending.id());
            return Step.PROCESSED;
        } catch (JacksonException invalid) {
            return discard(pending, "Stored VK event is invalid");
        } catch (IOException failure) {
            store.failUpdate(SOURCE, pending.id(), "VK event processing failed", clock.instant().plusSeconds(1), 3);
            return Step.EVENT_FAILED;
        }
    }

    private Step discard(PendingUpdate pending, String reason) throws SQLException {
        store.failUpdate(SOURCE, pending.id(), reason, clock.instant(), 1);
        return Step.EVENT_FAILED;
    }

    private static IncomingUpdate queuedUpdate(JsonNode event) {
        var payload = event.toString();
        var id = event.path("event_id").asString("");
        return new IncomingUpdate(id.isEmpty() ? HexFormat.of().formatHex(VkApiClient.sha256(payload)) : id, payload);
    }

    public enum Step {
        POLLED, DRAINING, PROCESSED, WAITING_FOR_RETRY, EVENT_FAILED, KEY_REFRESHED, HISTORY_EXPIRED
    }

    @FunctionalInterface
    interface EventHandler {
        void route(JsonNode event) throws IOException, SQLException, InterruptedException;
    }
}
