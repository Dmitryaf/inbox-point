package com.inboxpoint.telegram;

record TelegramTopicsInbox(TelegramBotApi api, long group) implements OperatorInbox {
    public String open(String request, String message, String title, String reusableTopic) throws TelegramBotApi.RequestFailed, InterruptedException {
        if (reusableTopic != null) {
            try {
                reopen(reusableTopic);
                return reusableTopic;
            } catch (TelegramBotApi.RequestFailed unavailable) {
                if (unavailable.topicProblem() != TelegramBotApi.TopicProblem.MISSING) {
                    throw unavailable;
                }
            }
        }
        return Long.toString(api.createForumTopic(group, title));
    }

    public Relay relay(String request, String topic, String message, int offset, boolean initial, String text) throws TelegramBotApi.RequestFailed, InterruptedException {
        return new Relay(topic, Long.toString(api.sendMessage(group, Long.parseLong(topic), text)));
    }

    @Override
    public Relay relayEnrollment(String request, String topic, String message, int part, boolean initial,
            String text, String enrollment) throws TelegramBotApi.RequestFailed, InterruptedException {
        return new Relay(topic, Long.toString(api.sendMessage(group, Long.parseLong(topic), text,
                enrollmentKeyboard(enrollment, "Подтвердить запись"))));
    }

    @Override
    public void enrollmentDelivered(TelegramStore.EnrollmentNotice notice)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        api.editMessageReplyMarkup(group, notice.message(), enrollmentKeyboard(notice.enrollment(), "Подтверждение отправлено"));
    }

    private static tools.jackson.databind.JsonNode enrollmentKeyboard(String enrollment, String title) {
        var keyboard = tools.jackson.databind.json.JsonMapper.shared().createObjectNode();
        keyboard.putArray("inline_keyboard").addArray().addObject().put("text", title).put("callback_data", "enroll:" + enrollment);
        return keyboard;
    }

    @Override
    public void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        var heading = delivery.outcomeUnknown() ? "⚠️ Не удалось подтвердить доставку ответа клиенту."
                : "⚠️ Ответ клиенту не доставлен.";
        var next = delivery.outcomeUnknown()
                ? "Не отправляйте ответ повторно вслепую. Владелец должен уточнить получение и разрешить инцидент в /ops."
                : "Владелец может повторить доставку в /ops.";
        var reference = delivery.operatorMessageId() == null ? "" : "\nСообщение администратора: " + delivery.operatorMessageId();
        relay(delivery.requestId(), delivery.operatorTopicId(), delivery.id(), 0, false, heading + "\n\nКанал: " + delivery.channel() + reference + "\n\n" + next);
    }

    public void close(String topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.closeTopic(group, Long.parseLong(topic));
    }

    public void reopen(String topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        api.reopenTopic(group, Long.parseLong(topic));
    }
}
