import { dirname, resolve } from 'node:path';

import { loadRuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { createApp, registerSetupRoutes } from '@/infrastructure/http/app.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import { registerManagementRoutes } from '@/modules/content-management/presentation/http/routes.js';
import { ContentManagementAccess } from '@/modules/content-management/security/content-management-access.js';
import { ChannelActivityMonitor } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import { DeliveryWorkerActivityMonitor } from '@/modules/operations-monitoring/application/delivery-worker-activity-monitor.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerOperationsRoutes } from '@/modules/operations-monitoring/presentation/http/routes.js';
import { registerReadinessRoute } from '@/modules/operations-monitoring/presentation/http/readiness-route.js';
import { OperationsAccess } from '@/modules/operations-monitoring/security/operations-access.js';
import { SqliteBackupService } from '@/infrastructure/persistence/sqlite-backup-service.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { FileTelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';
import { FileVkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';
import { startChannelRuntime } from '@/infrastructure/runtime/start-channel-runtime.js';
import { TelegramRuntime } from '@/infrastructure/telegram/telegram-runtime.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { VkRuntime } from '@/infrastructure/vk/vk-runtime.js';
import { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';

async function start(): Promise<void> {
  const startedAt = new Date();
  const config = loadRuntimeConfig(process.env);
  const repository = new SqliteSupportRepository(config.databasePath);
  const backupService = new SqliteBackupService(config.databasePath);
  const app = createApp(config);
  const contentSettingsStore = new FileContentSettingsStore(
    resolve(dirname(config.databasePath), 'content-settings.json'),
  );
  const informationCatalog = new ClientInformationCatalog();
  const channelActivity = new ChannelActivityMonitor();
  const deliveryActivity = new DeliveryWorkerActivityMonitor();
  const settingsStore = new FileTelegramSettingsStore(
    resolve(dirname(config.databasePath), 'telegram-settings.json'),
  );
  const vkSettingsStore = new FileVkSettingsStore(
    resolve(dirname(config.databasePath), 'vk-settings.json'),
  );
  const telegramRuntime = new TelegramRuntime(
    repository,
    {
      error: (error, message) => app.log.error({ err: error }, message),
    },
    informationCatalog,
    channelActivity,
    deliveryActivity,
  );
  const vkRuntime = new VkRuntime(
    telegramRuntime,
    repository,
    {
      error: (error, message) => app.log.error({ err: error }, message),
    },
    informationCatalog,
    channelActivity,
  );
  let closing = false;

  const close = async (signal: NodeJS.Signals): Promise<void> => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await vkRuntime.stop();
    await telegramRuntime.stop();
    repository.close();
  };

  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  try {
    try {
      informationCatalog.replace((await contentSettingsStore.load()) ?? {});
    } catch (error: unknown) {
      app.log.error({ err: error }, 'Ignoring invalid local content settings');
    }
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
    let storedVk;
    if (!config.vk) {
      try {
        storedVk = await vkSettingsStore.load();
      } catch (error: unknown) {
        app.log.error({ err: error }, 'Ignoring invalid local VK settings');
      }
    }
    const vkSource = config.vk ? 'environment' : storedVk ? 'local' : 'none';
    const vkSetup = new VkSetupController(vkRuntime, vkSettingsStore, vkSource);
    const contentSetup = new ContentManagementService(
      informationCatalog,
      contentSettingsStore,
    );
    registerSetupRoutes(app, setup, repository, backupService, vkSetup, {
      enabled: config.nodeEnv !== 'production',
    });
    registerManagementRoutes(
      app,
      contentSetup,
      new ContentManagementAccess(config.contentAdminPassword),
      {
        allowLocalBypass: config.nodeEnv !== 'production',
        secureCookies: config.nodeEnv === 'production',
      },
    );
    const operationsMonitoring = new OperationsMonitoringService({
      channelActivity: (channel) => channelActivity.snapshot(channel),
      deliveryActivity: () => deliveryActivity.snapshot(),
      deliverySummary: () => repository.getDeliverySummary(),
      startedAt,
      telegramStatus: () => setup.status(),
      vkStatus: () => vkSetup.status(),
    });
    registerReadinessRoute(app, operationsMonitoring);
    registerOperationsRoutes(
      app,
      operationsMonitoring,
      new OperationsAccess(config.operationsAdminPassword),
      {
        allowLocalBypass: config.nodeEnv !== 'production',
        secureCookies: config.nodeEnv === 'production',
      },
    );
    await app.listen({ host: config.host, port: config.port });
    const runtimeLogger = {
      error: (error: unknown, message: string) =>
        app.log.error({ err: error }, message),
    };
    await Promise.all([
      startChannelRuntime({
        channel: 'Telegram',
        config: config.telegram ?? storedTelegram,
        logger: runtimeLogger,
        runtime: telegramRuntime,
      }),
      startChannelRuntime({
        channel: 'VK',
        config: config.vk ?? storedVk,
        logger: runtimeLogger,
        runtime: vkRuntime,
      }),
    ]);
    if (config.nodeEnv !== 'production') {
      app.log.info(
        `Open http://${config.host}:${config.port}/setup to configure the service`,
      );
    }
    if (config.contentAdminPassword || config.nodeEnv !== 'production') {
      app.log.info(
        `Open http://${config.host}:${config.port}/manage to edit client information`,
      );
    } else {
      app.log.warn('Remote content management is disabled');
    }
    if (config.operationsAdminPassword || config.nodeEnv !== 'production') {
      app.log.info(
        `Operational status API is available at http://${config.host}:${config.port}/api/ops/status`,
      );
    } else {
      app.log.warn('Remote operational monitoring is disabled');
    }
  } catch (error: unknown) {
    await app.close();
    await vkRuntime.stop();
    await telegramRuntime.stop();
    repository.close();
    throw error;
  }
}

start().catch((error: unknown) => {
  console.error('Failed to start Messenger Handoff', error);
  process.exitCode = 1;
});
