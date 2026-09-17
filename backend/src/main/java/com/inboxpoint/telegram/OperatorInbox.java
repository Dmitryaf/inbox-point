package com.inboxpoint.telegram;

interface OperatorInbox {
    String open(String request, String message, String title, String reusableTopic) throws TelegramBotApi.RequestFailed, InterruptedException;
    Relay relay(String request, String topic, String message, int offset, boolean initial, String text) throws TelegramBotApi.RequestFailed, InterruptedException;
    void close(String topic) throws TelegramBotApi.RequestFailed, InterruptedException;
    void reopen(String topic) throws TelegramBotApi.RequestFailed, InterruptedException;

    default void lifecycle(String topic, String request, String event, boolean open)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        if (open) {
            reopen(topic);
        } else {
            close(topic);
        }
    }

    default void mirror(String request, String topic, String message, int sequence, String text)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        relay(request, topic, message, sequence, false, text);
    }

    default void prepareRelay(String request, String topic, String message, int sequence, boolean initial) { }

    record Relay(String topic, String messageId) { }

    default void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        throw new TelegramBotApi.RequestFailed("Inbox does not support delivery notifications", false);
    }
}
