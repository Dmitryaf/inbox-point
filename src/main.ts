import { dirname, resolve } from 'node:path';

import { loadRuntimeConfig } from '@/config/runtime-config.js';
import { createApp, registerSetupRoutes } from '@/infrastructure/http/app.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { FileTelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';
import { TelegramRuntime } from '@/infrastructure/telegram/telegram-runtime.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';

async function start(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const repository = new SqliteSupportRepository(config.databasePath);
  const app = createApp(config, () => repository.getDeliverySummary());
  const settingsStore = new FileTelegramSettingsStore(
    resolve(dirname(config.databasePath), 'telegram-settings.json'),
  );
  const telegramRuntime = new TelegramRuntime(repository, {
    error: (error, message) => app.log.error({ err: error }, message),
  });
  let closing = false;

  const close = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await telegramRuntime.stop();
    repository.close();
  };

  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  try {
    let storedTelegram;
    if (!config.telegram) {
      try {
        storedTelegram = await settingsStore.load();
      } catch (error: unknown) {
        app.log.error(
          { err: error },
          'Ignoring invalid local Telegram settings',
        );
      }
    }
    const source = config.telegram
      ? 'environment'
      : storedTelegram
        ? 'local'
        : 'none';
    const setup = new TelegramSetupController(
      telegramRuntime,
      settingsStore,
      source,
    );
    registerSetupRoutes(app, setup);
    const telegramConfig = config.telegram ?? storedTelegram;
    if (telegramConfig) {
      try {
        await telegramRuntime.start(telegramConfig);
      } catch (error: unknown) {
        if (config.telegram) {
          throw error;
        }
        app.log.error(
          { err: error },
          'Saved Telegram connection could not be restored',
        );
      }
    }

    await app.listen({ host: config.host, port: config.port });
    app.log.info(
      `Open http://${config.host}:${config.port}/setup to configure the service`,
    );
  } catch (error: unknown) {
    await telegramRuntime.stop();
    repository.close();
    throw error;
  }
}

start().catch((error: unknown) => {
  console.error('Failed to start Messenger Handoff', error);
  process.exitCode = 1;
});
