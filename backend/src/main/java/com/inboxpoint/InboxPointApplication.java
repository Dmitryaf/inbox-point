package com.inboxpoint;

import java.util.Arrays;

import com.inboxpoint.operations.ChannelIdentityCommand;
import com.inboxpoint.operations.ServiceCommands;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InboxPointApplication {
    public static void main(String[] args) {
        if (args.length > 0 && ServiceCommands.isCommand(args[0])) {
            var exit = ServiceCommands.run(args[0], Arrays.copyOfRange(args, 1, args.length), System.getenv());
            if (exit != 0) {
                System.exit(exit);
            }
            return;
        }
        if (args.length > 0 && "channel-confirm".equals(args[0])) {
            var exit = ChannelIdentityCommand.fromProcess(Arrays.copyOfRange(args, 1, args.length),
                    System.out::println, System.err::println);
            if (exit != 0) {
                System.exit(exit);
            }
            return;
        }
        SpringApplication.run(InboxPointApplication.class, args);
    }
}
