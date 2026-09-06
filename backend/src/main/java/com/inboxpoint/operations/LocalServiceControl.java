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
            if (json.path("version").asInt() != 1) {
                throw new IllegalArgumentException("Unsupported service control version");
            }
            state = new State(Map.of("telegram", mode(json.at("/channels/telegram")),
                    "vk", mode(json.at("/channels/vk"))),
                    json.path("delivery").isMissingNode() ? new Mode("active", null) : mode(json.path("delivery")));
        } catch (NoSuchFileException absent) {
            state = new State(Map.of("telegram", new Mode("active", null), "vk", new Mode("active", null)), new Mode("active", null));
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

    public State current() {
        return state;
    }

    public synchronized State set(String channel, boolean paused, Instant now) throws IOException {
        if (!CHANNELS.contains(channel)) {
            throw new IllegalArgumentException("Unknown channel");
        }
        var values = new java.util.LinkedHashMap<>(state.channels());
        values.put(channel, new Mode(paused ? "paused" : "active", now.toString()));
        return save(new State(Map.copyOf(values), state.delivery()));
    }

    public synchronized State setDelivery(boolean paused, Instant now) throws IOException {
        var desired = paused ? "paused" : "active";
        if (desired.equals(state.delivery().mode())) {
            return state;
        }
        return save(new State(state.channels(), new Mode(desired, now.toString())));
    }

    private State save(State next) throws IOException {
        var json = JsonMapper.shared().createObjectNode().put("version", 1);
        json.set("channels", JsonMapper.shared().valueToTree(next.channels()));
        json.set("delivery", JsonMapper.shared().valueToTree(next.delivery()));
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

    public record State(Map<String, Mode> channels, Mode delivery) { }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Mode(String mode, String changedAt) { }
}
