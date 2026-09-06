package com.inboxpoint.telegram;

interface OperatorInbox {
    long open(String title) throws TelegramBotApi.RequestFailed, InterruptedException;
    long relay(long topic, String text) throws TelegramBotApi.RequestFailed, InterruptedException;
    void close(long topic) throws TelegramBotApi.RequestFailed, InterruptedException;
    void reopen(long topic) throws TelegramBotApi.RequestFailed, InterruptedException;
}
