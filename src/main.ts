import { loadRuntimeConfig } from '@/config/runtime-config.js';
import { HandoffService } from '@/core/application/handoff-service.js';
import { createApp } from '@/infrastructure/http/app.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { TelegramApiClient } from '@/infrastructure/telegram/telegram-api-client.js';
import { TelegramClientChannel } from '@/infrastructure/telegram/telegram-client-channel.js';
import { TelegramPoller } from '@/infrastructure/telegram/telegram-poller.js';
import { TelegramTopicsInbox } from '@/infrastructure/telegram/telegram-topics-inbox.js';
import { TelegramUpdateRouter } from '@/infrastructure/telegram/telegram-update-router.js';

async function start(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const app = createApp(config);
  const repository = new SqliteSupportRepository(config.databasePath);
  const abortController = new AbortController();
  let poller: TelegramPoller | undefined;
  let pollerPromise: Promise<void> | undefined;
  let closing = false;

  const close = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, 'Shutting down');
    abortController.abort();
    await app.close();
    await pollerPromise?.catch((error: unknown) => {
      if (!isAbortError(error)) {
        app.log.error({ error }, 'Telegram poller stopped during shutdown');
      }
    });
    repository.close();
  };

  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  try {
    if (config.telegram) {
      const gateway = new TelegramApiClient(config.telegram.botToken);
      await gateway.verifySetup(config.telegram.operatorChatId);
      const telegramChannel = new TelegramClientChannel(gateway);
      const operatorInbox = new TelegramTopicsInbox(
        gateway,
        config.telegram.operatorChatId,
      );
      const handoffService = new HandoffService({
        clientChannels: [telegramChannel],
        operatorInbox,
        repository,
      });
      const router = new TelegramUpdateRouter(
        handoffService,
        config.telegram.operatorChatId,
      );
      poller = new TelegramPoller(
        gateway,
        router,
        config.telegram.pollTimeoutSeconds,
      );
    }

    await app.listen({ host: config.host, port: config.port });

    if (poller) {
      pollerPromise = poller.run(abortController.signal);
      void pollerPromise.catch((error: unknown) => {
        if (!abortController.signal.aborted) {
          app.log.fatal({ error }, 'Telegram poller stopped unexpectedly');
          process.exitCode = 1;
          void close('SIGTERM');
        }
      });
    }
  } catch (error: unknown) {
    abortController.abort();
    repository.close();
    throw error;
  }
}

start().catch((error: unknown) => {
  console.error('Failed to start Messenger Handoff', error);
  process.exitCode = 1;
});

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
