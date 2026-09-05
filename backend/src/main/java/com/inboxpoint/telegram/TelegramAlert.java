package com.inboxpoint.telegram;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;

public final class TelegramAlert implements AutoCloseable {
    private final long chat;
    private final TelegramHttpTransport transport;
    private final TelegramBotApi api;

    public TelegramAlert(String token, long chat, Duration timeout) {
        if (!token.matches("[0-9]+:[A-Za-z0-9_-]+") || chat == 0) {
            throw new IllegalArgumentException("Invalid Telegram alert settings");
        }
        this.chat = chat;
        transport = TelegramHttpTransport.open("", timeout);
        api = new TelegramBotApi(transport, URI.create("https://api.telegram.org"), token, timeout);
    }

    public void send(String message) throws IOException, InterruptedException {
        api.sendMessage(chat, null, message);
    }

    @Override
    public void close() {
        transport.close();
    }
}
