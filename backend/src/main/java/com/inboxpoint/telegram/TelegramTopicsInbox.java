package com.inboxpoint.telegram;

record TelegramTopicsInbox(TelegramBotApi api, long group) implements OperatorInbox {
    public String open(String request, String title) throws TelegramBotApi.RequestFailed, InterruptedException {
        return Long.toString(api.createForumTopic(group, title));
    }

    public Relay relay(String request, String topic, String message, int offset, String text) throws TelegramBotApi.RequestFailed, InterruptedException {
        return new Relay(topic, Long.toString(api.sendMessage(group, Long.parseLong(topic), text)));
    }

    @Override
    public void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        var heading = delivery.outcomeUnknown() ? "⚠️ Не удалось подтвердить доставку ответа клиенту."
                : "⚠️ Ответ клиенту не доставлен.";
        var next = delivery.outcomeUnknown()
                ? "Не отправляйте ответ повторно вслепую. Владелец должен уточнить получение и разрешить инцидент в /ops."
                : "Владелец может повторить доставку в /ops.";
        var reference = delivery.operatorMessageId() == null ? "" : "\nСообщение оператора: " + delivery.operatorMessageId();
        relay(delivery.requestId(), delivery.operatorTopicId(), delivery.id(), 0, heading + "\n\nКанал: " + delivery.channel() + reference + "\n\n" + next);
    }

    public void close(String topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.closeTopic(group, Long.parseLong(topic));
    }

    public void reopen(String topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.reopenTopic(group, Long.parseLong(topic));
    }
}
