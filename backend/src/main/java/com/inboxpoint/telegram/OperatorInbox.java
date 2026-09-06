package com.inboxpoint.telegram;

interface OperatorInbox {
    String open(String request, String title) throws TelegramBotApi.RequestFailed, InterruptedException;
    String relay(String topic, String message, int offset, String text) throws TelegramBotApi.RequestFailed, InterruptedException;
    void close(String topic) throws TelegramBotApi.RequestFailed, InterruptedException;
    void reopen(String topic) throws TelegramBotApi.RequestFailed, InterruptedException;

    default void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        throw new TelegramBotApi.RequestFailed("Inbox does not support delivery notifications", false);
    }
}
