package com.inboxpoint.telegram;

import java.util.function.Supplier;

final class SwitchableOperatorInbox implements OperatorInbox {
    private final Supplier<OperatorInbox> primary;
    private final OperatorInbox fallback = new EmergencyOperatorInbox();

    SwitchableOperatorInbox(Supplier<OperatorInbox> primary) {
        this.primary = primary;
    }

    public String open(String request, String title) throws InterruptedException {
        return route("", target -> target.open(request, title));
    }

    public String relay(String topic, String message, int offset, String text) throws InterruptedException {
        return route(topic, target -> target.relay(topic, message, offset, text));
    }

    public void close(String topic) throws InterruptedException {
        route(topic, target -> { target.close(topic); return null; });
    }

    public void reopen(String topic) throws InterruptedException {
        route(topic, target -> { target.reopen(topic); return null; });
    }

    public void notifyFailure(TelegramRuntime.DeliveryIncident delivery)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        if (delivery.operatorTopicId().startsWith("web:")) {
            return;
        }
        var target = primary.get();
        if (target == null) {
            throw new TelegramBotApi.RequestFailed("Operator Telegram topics are unavailable", false);
        }
        target.notifyFailure(delivery);
    }

    private <T> T route(String topic, Operation<T> operation) throws InterruptedException {
        var target = topic.startsWith("web:") ? null : primary.get();
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
