package com.inboxpoint.persistence;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import tools.jackson.databind.JsonNode;

public final class LocalJsonFile {
    private LocalJsonFile() { }

    public static void write(Path destination, JsonNode content) throws IOException {
        writeText(destination, content.toPrettyString() + "\n");
    }

    public static void writeText(Path destination, String content) throws IOException {
        var file = destination.toAbsolutePath();
        Files.createDirectories(file.getParent());
        var temporary = Files.createTempFile(file.getParent(), "." + file.getFileName(), ".tmp");
        try {
            Files.writeString(temporary, content);
            Files.move(temporary, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temporary);
        }
    }
}
