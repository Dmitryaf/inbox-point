package com.inboxpoint.telegram;

import java.util.function.Supplier;

final class SwitchableOperatorInbox implements OperatorInbox {
    private final Supplier<OperatorInbox> primary;
    private final OperatorInbox fallback = new EmergencyOperatorInbox();

    SwitchableOperatorInbox(Supplier<OperatorInbox> primary) {
        this.primary = primary;
    }

    public String open(String request, String message, String title, String reusableTopic) throws InterruptedException {
        return route("", target -> target.open(request, message, title, reusableTopic));
    }

    @Override
    public void prepareRelay(String request, String topic, String message, int sequence, boolean initial) {
        var target = EmergencyOperatorInbox.isWebTopic(topic) ? null : primary.get();
        if (target != null) {
            target.prepareRelay(request, topic, message, sequence, initial);
        }
    }

    public Relay relay(String request, String topic, String message, int offset, boolean initial, String text) throws InterruptedException {
        return route(topic, target -> target.relay(request, topic, message, offset, initial, text));
    }

    @Override
    public void mirror(String request, String topic, String message, int sequence, String text)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        if (EmergencyOperatorInbox.isWebTopic(topic)) {
            return;
        }
        var target = primary.get();
        if (target == null) {
            throw new TelegramBotApi.RequestFailed("Operator Telegram topics are unavailable", false);
        }
        target.mirror(request, topic, message, sequence, text);
    }

    @Override
    public void lifecycle(String topic, String request, String event, boolean open)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        var target = EmergencyOperatorInbox.isWebTopic(topic) ? fallback : primary.get();
        if (target == null) {
            throw new TelegramBotApi.RequestFailed("Operator Telegram topics are unavailable", false);
        }
        target.lifecycle(topic, request, event, open);
    }

    public void close(String topic) throws InterruptedException {
        route(topic, target -> { target.close(topic); return null; });
    }

    public void reopen(String topic) throws InterruptedException {
        route(topic, target -> { target.reopen(topic); return null; });
    }

    public void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        if (EmergencyOperatorInbox.isWebTopic(delivery.operatorTopicId())) {
            return;
        }
        var target = primary.get();
        if (target == null) {
            throw new TelegramBotApi.RequestFailed("Operator Telegram topics are unavailable", false);
        }
        target.notifyFailure(delivery);
    }

    private <T> T route(String topic, Operation<T> operation) throws InterruptedException {
        var target = EmergencyOperatorInbox.isWebTopic(topic) ? null : primary.get();
        if (target != null) {
            try {
                return operation.run(target);
            } catch (TelegramBotApi.RequestFailed unavailable) {
                org.slf4j.LoggerFactory.getLogger(SwitchableOperatorInbox.class).warn("Using the emergency operator inbox");
            }
        }
        try {
            return operation.run(fallback);
        } catch (TelegramBotApi.RequestFailed impossible) {
            throw new IllegalStateException("Local inbox failed", impossible);
        }
    }

    @FunctionalInterface
    private interface Operation<T> {
        T run(OperatorInbox inbox) throws TelegramBotApi.RequestFailed, InterruptedException;
    }
}
