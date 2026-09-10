import { dirname, resolve } from 'node:path';

import { loadRuntimeConfig } from '@/config/runtime-config.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { DataRetentionService } from '@/core/application/data-retention-service.js';
import { HandoffRuntime } from '@/core/application/handoff-runtime.js';
import { InboundEventIncidentService } from '@/core/application/inbound-event-incident-service.js';
import { OperatorActionIncidentService } from '@/core/application/operator-action-incident-service.js';
import { createAdminRouteAccess } from '@/infrastructure/http/admin-route-access.js';
import { registerAdminSessionRoutes } from '@/infrastructure/http/admin-session-routes.js';
import { registerFrontendRoutes } from '@/infrastructure/http/frontend-asset-routes.js';
import { loadFrontendAssets } from '@/infrastructure/http/frontend-assets.js';
import { createApp } from '@/infrastructure/http/app.js';
import { PasswordSessionAccess } from '@/infrastructure/security/password-session-access.js';
import { ContentManagementService } from '@/modules/content-management/application/content-management-service.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import { registerManagementRoutes } from '@/modules/content-management/presentation/http/routes.js';
import { ChannelActivityMonitor } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import { DeliveryWorkerActivityMonitor } from '@/modules/operations-monitoring/application/delivery-worker-activity-monitor.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';
import { registerOperationsRoutes } from '@/modules/operations-monitoring/presentation/http/routes.js';
import { registerReadinessRoute } from '@/modules/operations-monitoring/presentation/http/readiness-route.js';
import { OperatorInboxService } from '@/modules/operator-inbox/application/operator-inbox-service.js';
import { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { FileServiceControlStore } from '@/modules/service-control/infrastructure/file-store/file-service-control-store.js';
import { createDefaultServiceControlState } from '@/modules/service-control/model/service-control-state.js';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import { FileTelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';
import { FileVkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';
import { startChannelRuntime } from '@/infrastructure/runtime/start-channel-runtime.js';
import { TelegramRuntime } from '@/infrastructure/telegram/telegram-runtime.js';
import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';
import { createTelegramHttpTransport } from '@/infrastructure/telegram/telegram-http-transport.js';
import { VkRuntime } from '@/infrastructure/vk/vk-runtime.js';
import { VkSetupController } from '@/infrastructure/vk/vk-setup-controller.js';
import { registerSetupRoutes } from '@/modules/channel-setup/presentation/http/routes.js';

async function start(): Promise<void> {
  const startedAt = new Date();
  const config = loadRuntimeConfig(process.env);
  const telegramTransport = createTelegramHttpTransport(
    config.telegramProxyUrl,
  );
  const serviceControlStore = new FileServiceControlStore(
    resolve(dirname(config.databasePath), 'service-control.json'),
  );
  const serviceControlState =
    (await serviceControlStore.load()) ?? createDefaultServiceControlState();
  const repository = new SqliteSupportRepository(config.databasePath);
  const app = createApp(config);
  const retention = new DataRetentionService(
    repository,
    config.closedRequestRetentionDays,
    {
      error: (error, message) => app.log.error({ err: error }, message),
      info: (details, message) => app.log.info(details, message),
      warn: (details, message) => app.log.warn(details, message),
    },
  );
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
  const serviceControl = new ServiceControlService(
    serviceControlState,
    serviceControlStore,
  );
  const handoffRuntime = new HandoffRuntime({
    activity: deliveryActivity,
    deliveryPolicy: serviceControl,
    logger: {
      error: (error, message) => app.log.error({ err: error }, message),
    },
    repository,
  });
  const telegramRuntime = new TelegramRuntime(
    handoffRuntime,
    repository,
    {
      error: (error, message) => app.log.error({ err: error }, message),
    },
    informationCatalog,
    channelActivity,
    serviceControl,
    telegramTransport.fetch,
  );
  const vkRuntime = new VkRuntime(
    handoffRuntime,
    repository,
    {
      error: (error, message) => app.log.error({ err: error }, message),
    },
    informationCatalog,
    channelActivity,
    serviceControl,
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
    await telegramTransport.close();
    await handoffRuntime.stop();
    retention.stop();
    repository.close();
  };

  process.once('SIGINT', () => void close('SIGINT'));
  process.once('SIGTERM', () => void close('SIGTERM'));

  try {
    retention.start();
    handoffRuntime.start();
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
      telegramTransport.fetch,
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
    const adminAccess = new PasswordSessionAccess(config.adminPassword);
    const adminRouteAccess = createAdminRouteAccess(app, adminAccess, {
      allowLocalBypass: config.nodeEnv !== 'production',
      secureCookies: config.nodeEnv === 'production',
    });
    registerAdminSessionRoutes(
      app,
      adminAccess,
      adminRouteAccess,
      config.nodeEnv === 'production',
    );
    registerSetupRoutes(app, setup, vkSetup, adminRouteAccess);
    registerManagementRoutes(app, contentSetup, adminRouteAccess);
    const operationsMonitoring = new OperationsMonitoringService({
      channelActivity: (channel) => channelActivity.snapshot(channel),
      deliveryActivity: () => deliveryActivity.snapshot(),
      deliveryFailures: () => repository.findFailedDeliveries(20),
      deliverySummary: () => repository.getDeliverySummary(),
      deliveryControlStatus: () => serviceControl.getState().delivery,
      intakeStatus: () => serviceControl.getState().channels,
      inboundEventIncidents: () => repository.findQuarantinedInboundEvents(20),
      inboundEventSummary: () => repository.getInboundEventSummary(),
      operatorActionIncidents: () => repository.findOperatorActionIncidents(20),
      operatorActionSummary: () => repository.getOperatorActionSummary(),
      startedAt,
      telegramStatus: () => setup.status(),
      vkStatus: () => vkSetup.status(),
    });
    registerReadinessRoute(app, operationsMonitoring);
    const operatorInbox = new OperatorInboxService(repository, handoffRuntime);
    const operatorActionIncidents = new OperatorActionIncidentService(
      repository,
    );
    const inboundEventIncidents = new InboundEventIncidentService(repository);
    registerOperationsRoutes(app, adminRouteAccess, {
      deliveries: repository,
      inboundEvents: inboundEventIncidents,
      monitoring: operationsMonitoring,
      operatorActions: operatorActionIncidents,
      operatorInbox,
      serviceControl,
      usageMetrics: repository,
    });
    registerFrontendRoutes(app, adminRouteAccess, loadFrontendAssets());
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
    const adminUiAvailable =
      Boolean(config.adminPassword) || config.nodeEnv !== 'production';
    if (adminUiAvailable) {
      app.log.info(
        `Open http://${config.host}:${config.port}/setup to configure the service`,
      );
      app.log.info(
        `Open http://${config.host}:${config.port}/manage to edit client information`,
      );
      app.log.info(
        `Operational status API is available at http://${config.host}:${config.port}/api/ops/status`,
      );
    } else {
      app.log.warn('Remote content management is disabled');
      app.log.warn('Remote operational monitoring is disabled');
    }
  } catch (error: unknown) {
    await app.close();
    await vkRuntime.stop();
    await telegramRuntime.stop();
    await telegramTransport.close();
    await handoffRuntime.stop();
    retention.stop();
    repository.close();
    throw error;
  }
}

start().catch((error: unknown) => {
  console.error('Failed to start Messenger Handoff', error);
  process.exitCode = 1;
});
