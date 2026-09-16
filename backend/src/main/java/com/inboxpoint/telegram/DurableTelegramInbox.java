package com.inboxpoint.telegram;

import java.io.IOException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Clock;

final class DurableTelegramInbox implements OperatorInbox {
    private final OperatorInbox delegate;
    private final Path database;
    private final Clock clock;

    DurableTelegramInbox(OperatorInbox delegate, Path database, Clock clock) {
        this.delegate = delegate;
        this.database = database;
        this.clock = clock;
    }

    @Override
    public String open(String request, String message, String title, String reusableTopic) throws TelegramBotApi.RequestFailed, InterruptedException {
        var key = new OperatorActions.Key("operator-open:" + request, request, "open_request", "web:" + request, message, 0, true);
        return perform(key, () -> delegate.open(request, message, title, reusableTopic));
    }

    @Override
    public void prepareRelay(String request, String topic, String message, int sequence, boolean initial) {
        try (var store = new TelegramStore(database)) {
            store.operatorActions().prepare(relayKey(request, topic, message, sequence, initial), clock.instant());
        } catch (IOException | SQLException failure) {
            throw new IllegalStateException("Could not prepare operator relay", failure);
        }
    }

    @Override
    public Relay relay(String request, String topic, String message, int sequence, boolean initial, String text)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        var key = relayKey(request, topic, message, sequence, initial);
        return new Relay(topic, perform(key, () -> delegate.relay(request, topic, message, sequence, initial, text).messageId()));
    }

    static OperatorActions.Key relayKey(String request, String topic, String message, int sequence, boolean initial) {
        return new OperatorActions.Key("operator-relay:" + request + ":" + message + ":" + sequence,
                request, "relay_message", topic, message, sequence, initial);
    }

    private String perform(OperatorActions.Key key, Send send) throws InterruptedException, TelegramBotApi.RequestFailed {
        try (var store = new TelegramStore(database)) {
            var actions = store.operatorActions();
            var attempt = actions.prepare(key, clock.instant());
            if ("sent".equals(attempt.status())) {
                return attempt.result() == null ? "confirmed:" + key.id() : attempt.result();
            }
            if (!actions.begin(key.id(), clock.instant())) {
                throw new UnknownOutcome(key.id());
            }
            String result;
            try {
                result = send.execute();
            } catch (TelegramBotApi.RequestFailed failure) {
                actions.reject(key.id(), failure.outcomeUnknown());
                if (failure.outcomeUnknown()) {
                    throw new UnknownOutcome(key.id());
                }
                throw failure;
            }
            try {
                actions.complete(key.id(), result, clock.instant());
            } catch (SQLException failure) {
                try {
                    actions.reject(key.id(), true);
                } catch (SQLException markFailure) {
                    failure.addSuppressed(markFailure);
                }
                throw new UnknownOutcome(key.id(), failure);
            }
            return result;
        } catch (TelegramBotApi.RequestFailed failure) {
            throw failure;
        } catch (IOException | SQLException failure) {
            throw new IllegalStateException("Operator action storage is unavailable", failure);
        }
    }

    @Override
    public void lifecycle(String topic, String request, String event, boolean open)
            throws TelegramBotApi.RequestFailed, InterruptedException {
        var key = lifecycleKey(topic, request, event, open);
        perform(key, () -> {
            delegate.lifecycle(topic, request, event, open);
            return topic;
        });
    }

    static OperatorActions.Key lifecycleKey(String topic, String request, String event, boolean open) {
        var kind = open ? "reopen_request" : "close_request";
        return new OperatorActions.Key("operator-" + kind + ":" + request + ":" + event,
                request, kind, topic, event, 0, false);
    }

    @Override
    public void close(String topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        delegate.close(topic);
    }

    @Override
    public void reopen(String topic) throws TelegramBotApi.RequestFailed, InterruptedException {
        delegate.reopen(topic);
    }

    @Override
    public void notifyFailure(TelegramRuntime.DeliveryIncident delivery) throws TelegramBotApi.RequestFailed, InterruptedException {
        delegate.notifyFailure(delivery);
    }

    @FunctionalInterface
    private interface Send {
        String execute() throws TelegramBotApi.RequestFailed, InterruptedException;
    }

    static final class UnknownOutcome extends RuntimeException {
        UnknownOutcome(String action) {
            this(action, null);
        }

        UnknownOutcome(String action, Throwable cause) {
            super("Operator action outcome unknown: " + action, cause);
        }
    }
}
