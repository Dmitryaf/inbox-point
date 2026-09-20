package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.inboxpoint.persistence.LocalJsonFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class LocalServiceControl {
    private static final List<String> CHANNELS = List.of("telegram", "vk");
    private final Path file;
    private volatile State state;

    public LocalServiceControl(Path database) {
        file = database.toAbsolutePath().resolveSibling("service-control.json");
        try {
            var json = JsonMapper.shared().readTree(Files.readString(file));
            if (!json.isObject() || json.size() < 2 || json.size() > 3 || !json.has("channels") || !json.has("delivery")) {
                throw new IllegalArgumentException("Unsupported service control version");
            }
            state = new State(Map.of("telegram", mode(json.at("/channels/telegram")),
                    "vk", mode(json.at("/channels/vk"))),
                    mode(json.path("delivery")), Map.of("telegram", json.at("/expectedChannels/telegram").asBoolean(false),
                            "vk", json.at("/expectedChannels/vk").asBoolean(false)));
        } catch (NoSuchFileException absent) {
            state = new State(Map.of("telegram", new Mode("active", null), "vk", new Mode("active", null)), new Mode("active", null), Map.of("telegram", false, "vk", false));
        } catch (IOException | RuntimeException failure) {
            throw new IllegalArgumentException("Local service control settings could not be read");
        }
    }

    public boolean intakePaused(String channel) {
        return "paused".equals(state.channels().get(channel).mode());
    }

    public boolean deliveryPaused() {
        return "paused".equals(state.delivery().mode());
    }

    public boolean expected(String channel) {
        return state.expectedChannels().getOrDefault(channel, false);
    }

    public synchronized void setExpected(String channel, boolean expected) throws IOException {
        if (!CHANNELS.contains(channel)) {
            throw new IllegalArgumentException("Unknown channel");
        }
        var values = new java.util.LinkedHashMap<>(state.expectedChannels());
        values.put(channel, expected);
        save(new State(state.channels(), state.delivery(), Map.copyOf(values)));
    }

    public State current() {
        return state;
    }

    public synchronized State set(String channel, boolean paused, Instant now) throws IOException {
        if (!CHANNELS.contains(channel)) {
            throw new IllegalArgumentException("Unknown channel");
        }
        var values = new java.util.LinkedHashMap<>(state.channels());
        values.put(channel, new Mode(paused ? "paused" : "active", now.toString()));
        return save(new State(Map.copyOf(values), state.delivery(), state.expectedChannels()));
    }

    public synchronized State setDelivery(boolean paused, Instant now) throws IOException {
        var desired = paused ? "paused" : "active";
        if (desired.equals(state.delivery().mode())) {
            return state;
        }
        return save(new State(state.channels(), new Mode(desired, now.toString()), state.expectedChannels()));
    }

    private State save(State next) throws IOException {
        var json = JsonMapper.shared().createObjectNode();
        json.set("channels", JsonMapper.shared().valueToTree(next.channels()));
        json.set("delivery", JsonMapper.shared().valueToTree(next.delivery()));
        json.set("expectedChannels", JsonMapper.shared().valueToTree(next.expectedChannels()));
        LocalJsonFile.write(file, json);
        state = next;
        return next;
    }

    private static Mode mode(JsonNode input) {
        var mode = input.path("mode").asString("");
        if (!"active".equals(mode) && !"paused".equals(mode)) {
            throw new IllegalArgumentException("Invalid intake mode");
        }
        var date = input.path("changedAt");
        var changedAt = date.isMissingNode() ? null : Instant.parse(date.asString("")).toString();
        return new Mode(mode, changedAt);
    }

    public record State(Map<String, Mode> channels, Mode delivery, Map<String, Boolean> expectedChannels) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Mode(String mode, String changedAt) { }
}
