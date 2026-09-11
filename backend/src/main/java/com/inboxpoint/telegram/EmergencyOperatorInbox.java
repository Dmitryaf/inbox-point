package com.inboxpoint.telegram;

final class EmergencyOperatorInbox implements OperatorInbox {
    @Override
    public String open(String request, String message, String title, String reusableTopic) {
        return webTopic(request);
    }

    @Override
    public Relay relay(String request, String topic, String message, int offset, boolean initial, String text) {
        return new Relay(isWebTopic(topic) ? topic : webTopic(request), "web:" + message + ":" + offset);
    }

    static boolean isWebTopic(String topic) {
        return topic.startsWith("web:");
    }

    private static String webTopic(String request) {
        return "web:" + request;
    }

    @Override
    public void close(String topic) { }

    @Override
    public void reopen(String topic) { }
}
