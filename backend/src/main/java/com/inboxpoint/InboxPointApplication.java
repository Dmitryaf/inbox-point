package com.inboxpoint;

import com.inboxpoint.operations.ServiceCommands;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InboxPointApplication {
    public static void main(String[] args) {
        if (args.length > 0 && ServiceCommands.handles(args[0])) {
            System.exit(ServiceCommands.run(args[0], System.getenv()));
        }
        SpringApplication.run(InboxPointApplication.class, args);
    }
}
