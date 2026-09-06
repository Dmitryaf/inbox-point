package com.inboxpoint.telegram;

record TelegramTopicsInbox(TelegramBotApi api, long group) implements OperatorInbox {
    public long open(String title) throws TelegramBotApi.RequestFailed, InterruptedException {
        return api.createForumTopic(group, title);
    }

    public long relay(long topic, String text) throws TelegramBotApi.RequestFailed, InterruptedException {
        return api.sendMessage(group, topic, text);
    }

    public void close(long topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.closeTopic(group, topic);
    }

    public void reopen(long topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.reopenTopic(group, topic);
    }
}
