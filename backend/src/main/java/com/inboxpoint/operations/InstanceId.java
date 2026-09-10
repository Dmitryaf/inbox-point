package com.inboxpoint.operations;

public final class InstanceId {
    private InstanceId() { }

    public static String validate(String value) {
        if (!value.matches("[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?")) {
            throw new IllegalArgumentException("Invalid service instance identifier");
        }
        return value;
    }
}
