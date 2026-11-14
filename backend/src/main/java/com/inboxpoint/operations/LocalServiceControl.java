package com.inboxpoint.operations;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;

import com.inboxpoint.persistence.LocalJsonFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

public final class LocalServiceControl {
    private static final JsonMapper JSON = JsonMapper.shared();
    private static final DateTimeFormatter TIMESTAMP = new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    private final Path file;

    public LocalServiceControl(Path database) {
        file = database.resolveSibling("service-control.json");
    }

    public boolean intakePaused(String channel) throws SQLException {
        return paused("/channels/" + channel + "/mode");
    }

    public boolean deliveryPaused() throws SQLException {
        return paused("/delivery/mode");
    }

    ExpectedChannels rememberConfiguredChannels(boolean telegram, boolean vk) throws IOException {
        return changeExpected(telegram ? Boolean.TRUE : null, vk ? Boolean.TRUE : null);
    }

    void setExpected(String channel, boolean expected) throws IOException {
        var telegram = "telegram".equals(channel);
        changeExpected(telegram ? expected : null, telegram ? null : expected);
    }

    ObjectNode state() throws IOException {
        return view(readControl());
    }

    synchronized ObjectNode setMode(String target, boolean paused, Instant now) throws IOException {
        var root = readControl();
        var value = JSON.createObjectNode().put("changedAt", TIMESTAMP.format(now)).put("mode", paused ? "paused" : "active");
        if ("delivery".equals(target)) {
            root.set(target, value);
        } else {
            root.withObjectProperty("channels").set(target, value);
        }
        LocalJsonFile.write(file, root);
        return view(root);
    }

    private synchronized ExpectedChannels changeExpected(Boolean telegram, Boolean vk) throws IOException {
        var root = readControl();
        var previous = root.get("expectedChannels");
        var oldTelegram = previous != null && previous.path("telegram").booleanValue();
        var oldVk = previous != null && previous.path("vk").booleanValue();
        var expected = new ExpectedChannels(telegram == null ? oldTelegram : telegram, vk == null ? oldVk : vk);
        if (expected.telegram() != oldTelegram || expected.vk() != oldVk) {
            root.putObject("expectedChannels").put("telegram", expected.telegram()).put("vk", expected.vk());
            LocalJsonFile.write(file, root);
        }
        return expected;
    }

    private ObjectNode readControl() throws IOException {
        try {
            var root = JSON.readTree(Files.readString(file));
            if (!(root instanceof ObjectNode control) || !mode(control.at("/channels/telegram/mode").asString(""))
                    || !mode(control.at("/channels/vk/mode").asString(""))
                    || !mode(control.at("/delivery/mode").asString("")) || !validExpected(control.get("expectedChannels"))) {
                throw new IOException("Local service control settings are invalid");
            }
            return control;
        } catch (NoSuchFileException missing) {
            var root = JSON.createObjectNode();
            var channels = root.putObject("channels");
            channels.putObject("telegram").put("mode", "active");
            channels.putObject("vk").put("mode", "active");
            root.putObject("delivery").put("mode", "active");
            root.putObject("expectedChannels").put("telegram", false).put("vk", false);
            return root;
        } catch (JacksonException invalid) {
            throw new IOException("Local service control settings are invalid");
        }
    }

    private boolean paused(String pointer) throws SQLException {
        try {
            var root = JSON.readTree(Files.readString(file));
            var mode = root == null ? "" : root.at(pointer).asString("");
            if (!mode(mode)) {
                throw new SQLException("Local service control settings are invalid");
            }
            return "paused".equals(mode);
        } catch (NoSuchFileException missing) {
            return false;
        } catch (IOException | JacksonException failure) {
            throw new SQLException("Could not load local service control settings");
        }
    }

    private static ObjectNode view(ObjectNode root) {
        var result = JSON.createObjectNode();
        var channels = result.putObject("channels");
        channels.set("telegram", modeView(root.at("/channels/telegram")));
        channels.set("vk", modeView(root.at("/channels/vk")));
        result.set("delivery", modeView(root.path("delivery")));
        if (root.has("expectedChannels")) {
            var expected = root.path("expectedChannels");
            result.putObject("expectedChannels").put("telegram", expected.path("telegram").booleanValue())
                    .put("vk", expected.path("vk").booleanValue());
        }
        return result;
    }

    private static ObjectNode modeView(JsonNode mode) {
        var result = JSON.createObjectNode().put("mode", mode.path("mode").asString());
        if (mode.path("changedAt").isString()) {
            result.put("changedAt", mode.path("changedAt").asString());
        }
        return result;
    }

    private static boolean validExpected(JsonNode expected) {
        return expected == null || (expected.isObject() && expected.path("telegram").isBoolean() && expected.path("vk").isBoolean());
    }

    private static boolean mode(String value) {
        return "active".equals(value) || "paused".equals(value);
    }

    record ExpectedChannels(boolean telegram, boolean vk) { }
}
