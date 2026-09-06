package com.inboxpoint.telegram;

interface OperatorInbox {
    String open(String request, String title) throws TelegramBotApi.RequestFailed, InterruptedException;
    Relay relay(String request, String topic, String message, int offset, String text) throws TelegramBotApi.RequestFailed, InterruptedException;
    void close(String topic) throws TelegramBotApi.RequestFailed, InterruptedException;
    void reopen(String topic) throws TelegramBotApi.RequestFailed, InterruptedException;

    record Relay(String topic, String messageId) { }

    default void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        throw new TelegramBotApi.RequestFailed("Inbox does not support delivery notifications", false);
    }
}
