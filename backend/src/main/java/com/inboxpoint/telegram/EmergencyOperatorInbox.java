package com.inboxpoint.telegram;

final class EmergencyOperatorInbox implements OperatorInbox {
    @Override
    public String open(String request, String title) {
        return "web:" + request;
    }

    @Override
    public String relay(String topic, String message, int offset, String text) {
        return "web:" + message + ":" + offset;
    }

    @Override
    public void close(String topic) { }

    @Override
    public void reopen(String topic) { }
}
