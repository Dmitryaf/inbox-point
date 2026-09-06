package com.inboxpoint.telegram;

record TelegramTopicsInbox(TelegramBotApi api, long group) implements OperatorInbox {
    public long open(String title) throws TelegramBotApi.RequestFailed, InterruptedException {
        return api.createForumTopic(group, title);
    }

    public long relay(long topic, String text) throws TelegramBotApi.RequestFailed, InterruptedException {
        return api.sendMessage(group, topic, text);
    }

    @Override
    public void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        var heading = delivery.outcomeUnknown() ? "⚠️ Не удалось подтвердить доставку ответа клиенту."
                : "⚠️ Ответ клиенту не доставлен.";
        var next = delivery.outcomeUnknown()
                ? "Не отправляйте ответ повторно вслепую. Владелец должен уточнить получение и разрешить инцидент в /ops."
                : "Владелец может повторить доставку в /ops.";
        var reference = delivery.operatorMessageId() == null ? "" : "\nСообщение преподавателя: " + delivery.operatorMessageId();
        relay(Long.parseLong(delivery.operatorTopicId()), heading + "\n\nКанал: " + delivery.channel() + reference + "\n\n" + next);
    }

    public void close(long topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.closeTopic(group, topic);
    }

    public void reopen(long topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.reopenTopic(group, topic);
    }
}
