package com.inboxpoint.operations;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.sql.SQLException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Set;
import java.util.function.Consumer;

import com.inboxpoint.persistence.SqliteChannelIdentity;
import com.inboxpoint.telegram.TelegramHttpTransport;
import com.inboxpoint.telegram.TelegramTextHandoff;
import com.inboxpoint.vk.VkTextHandoff;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.StandardEnvironment;

public final class ChannelIdentityCommand {
    private static final String CONFIRM = "--confirm-previous-connection";
    private static final Duration TIMEOUT = Duration.ofSeconds(8);
    private static final Set<String> ID_OPTIONS = Set.of("--bot-id", "--operator-chat-id", "--group-id");

    private ChannelIdentityCommand() { }

    public static int fromProcess(String[] args, Consumer<String> output, Consumer<String> error) {
        var apacheLogger = LoggerFactory.getLogger("org.apache.hc");
        if (apacheLogger instanceof ch.qos.logback.classic.Logger logger) {
            logger.setLevel(ch.qos.logback.classic.Level.OFF);
        }
        var environment = new StandardEnvironment();
        try {
            var database = Path.of(environment.getProperty("DATABASE_PATH", "./data/inbox-point.sqlite"));
            run(database, args, channel -> verify(database, environment, channel), output);
            return 0;
        } catch (CommandFailure failure) {
            error.accept(failure.getMessage());
        } catch (InterruptedException stopping) {
            Thread.currentThread().interrupt();
            error.accept("Проверка подключения прервана.");
        } catch (SQLException | IOException | RuntimeException failure) {
            error.accept("Не удалось проверить подключение. Проверьте настройки, доступ к платформе и версию базы.");
        }
        return 1;
    }

    static void run(Path database, String[] args, Probe probe, Consumer<String> write)
            throws IOException, SQLException, InterruptedException {
        var command = parse(args);
        try (var store = new SqliteChannelIdentity(database, command.identity() == null)) {
            var verified = probe.verify(command.channel());
            if ("telegram".equals(command.channel())) {
                var ids = verified.split(":", 2);
                write.accept("Проверено: Telegram bot_id=" + ids[0] + ", operator_chat_id=" + ids[1] + ".");
            } else {
                write.accept("Проверено: VK group_id=" + verified + ".");
            }
            if (command.identity() == null) {
                write.accept(store.find(command.channel()) == null ? "Прежнее подключение ещё не подтверждено."
                        : "Привязка подключения уже сохранена.");
                write.accept("Сверьте ID с прежним подключением этой базы перед подтверждением.");
                return;
            }
            if (!command.identity().equals(verified)) {
                throw new CommandFailure("Указанные ID не совпали с проверенным подключением.");
            }
            if (!store.confirmPrevious(command.channel(), verified)) {
                throw new CommandFailure("База уже связана с другим подключением.");
            }
            write.accept("Прежнее подключение подтверждено.");
        }
    }

    private static String verify(Path database, Environment environment, String channel)
            throws IOException, InterruptedException {
        var config = ChannelSettings.read(database, environment, channel).config();
        if (config == null) {
            throw new CommandFailure("Восстановите прежние настройки канала и повторите проверку.");
        }
        var endpoints = ChannelApiEndpoints.production();
        if ("telegram".equals(channel)) {
            try (var http = TelegramHttpTransport.open(environment.getProperty("TELEGRAM_PROXY_URL", ""), TIMEOUT)) {
                return TelegramTextHandoff.verifyIdentity(http, endpoints.telegram(), config.token(), config.id(), TIMEOUT);
            }
        }
        try (var http = HttpClient.newBuilder().proxy(HttpClient.Builder.NO_PROXY).connectTimeout(TIMEOUT).build()) {
            return VkTextHandoff.verifyIdentity(http, endpoints.vk(), config.token(), config.id(), TIMEOUT);
        }
    }

    private static Command parse(String[] args) throws CommandFailure {
        if (args.length == 0 || (!"telegram".equals(args[0]) && !"vk".equals(args[0]))) {
            throw new CommandFailure("Укажите один канал: telegram или vk.");
        }
        var channel = args[0];
        var ids = new HashMap<String, String>();
        var confirm = false;
        for (int i = 1; i < args.length; i++) {
            if (CONFIRM.equals(args[i]) && !confirm) {
                confirm = true;
                continue;
            }
            var option = args[i].split("=", 2);
            if (!ID_OPTIONS.contains(option[0]) || ids.containsKey(option[0])) {
                throw new CommandFailure("Некорректные параметры подтверждения подключения.");
            }
            var value = option.length == 2 ? option[1] : ++i < args.length ? args[i] : "";
            ids.put(option[0], value);
        }
        if (!confirm && ids.isEmpty()) {
            return new Command(channel, null);
        }
        if (confirm && "telegram".equals(channel) && ids.size() == 2 && valid(ids.get("--bot-id"), false)
                && valid(ids.get("--operator-chat-id"), true)) {
            return new Command(channel, ids.get("--bot-id") + ":" + ids.get("--operator-chat-id"));
        }
        if (confirm && "vk".equals(channel) && ids.size() == 1 && valid(ids.get("--group-id"), false)) {
            return new Command(channel, ids.get("--group-id"));
        }
        throw new CommandFailure("Для подтверждения укажите --confirm-previous-connection и проверенные ID прежнего подключения.");
    }

    private static boolean valid(String value, boolean negative) {
        if (value == null || !value.matches(negative ? "-[1-9][0-9]{0,15}" : "[1-9][0-9]{0,15}")) {
            return false;
        }
        return Math.abs(Long.parseLong(value)) <= (1L << 53) - 1;
    }

    private record Command(String channel, String identity) { }

    @FunctionalInterface
    interface Probe {
        String verify(String channel) throws IOException, InterruptedException;
    }

    private static final class CommandFailure extends IOException {
        CommandFailure(String message) {
            super(message);
        }
    }
}
