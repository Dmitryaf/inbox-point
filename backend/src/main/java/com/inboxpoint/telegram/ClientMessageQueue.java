package com.inboxpoint.telegram;

import java.sql.SQLException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

final class ClientMessageQueue {
    private final ConcurrentHashMap<Client, Entry> clients = new ConcurrentHashMap<>();

    void run(String channel, long conversation, Work task)
            throws SQLException, InterruptedException, TelegramBotApi.RequestFailed {
        var client = new Client(channel, conversation);
        var entry = clients.compute(client, (key, current) -> {
            var result = current == null ? new Entry() : current;
            result.references++;
            return result;
        });
        try {
            entry.lock.lockInterruptibly();
            try {
                task.run();
            } finally {
                entry.lock.unlock();
            }
        } finally {
            clients.computeIfPresent(client, (key, current) -> --current.references == 0 ? null : current);
        }
    }

    @FunctionalInterface
    interface Work {
        void run() throws SQLException, InterruptedException, TelegramBotApi.RequestFailed;
    }

    private record Client(String channel, long conversation) { }

    private static final class Entry {
        private final ReentrantLock lock = new ReentrantLock(true);
        private int references;
    }
}
