import { expect, it, vi } from 'vitest';
import { SqliteSupportRepository } from '@/infrastructure/persistence/sqlite-support-repository.js';
import {
  TelegramRuntime,
  type TelegramHandoffHost,
} from '@/infrastructure/telegram/telegram-runtime.js';
import { VkRuntime } from '@/infrastructure/vk/vk-runtime.js';
import { VkApiClient } from '@/infrastructure/vk/vk-api-client.js';
import { ChannelActivityMonitor } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

it.each(['telegram', 'vk'] as const)(
  'records %s startup failures in operations before a poller exists',
  async (channel) => {
    const activity = new ChannelActivityMonitor();
    const repository = new SqliteSupportRepository(':memory:');
    const registerClientChannel = vi.fn(() => () => undefined);
    const host: TelegramHandoffHost = {
      handleClientMessage: vi.fn(() => Promise.resolve()),
      handleOperatorMessage: vi.fn(() => Promise.resolve()),
      handleOperatorTopicClosed: vi.fn(() => Promise.resolve()),
      handleOperatorTopicReopened: vi.fn(() => Promise.resolve()),
      recoverEmergencyRequests: vi.fn(() => Promise.resolve()),
      registerClientChannel,
      registerOperatorInbox: vi.fn(() => () => undefined),
    };
    const cause = Object.assign(new Error('synthetic-token private-message'), {
      code: 'UND_ERR_CONNECT_TIMEOUT',
    });
    const transport = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError('fetch failed', { cause })),
    );
    const telegram = new TelegramRuntime(
      host,
      repository,
      { error: vi.fn() },
      undefined,
      activity,
      undefined,
      transport,
    );
    const vk = new VkRuntime(
      { ...host, handleChannelOperatorMessage: vi.fn(() => Promise.resolve()) },
      repository,
      { error: vi.fn() },
      undefined,
      activity,
      undefined,
      (token) => new VkApiClient(token, transport),
    );
    try {
      const request =
        channel === 'telegram'
          ? telegram.start({
              botToken: 'synthetic-token',
              operatorChatId: -100,
              pollTimeoutSeconds: 30,
            })
          : vk.start({
              accessToken: 'synthetic-token',
              groupId: 42,
              pollTimeoutSeconds: 25,
            });
      await expect(request).rejects.toThrow('API request failed');
      const monitoring = new OperationsMonitoringService({
        channelActivity: (channel) => activity.snapshot(channel),
        deliveryActivity: () => ({ lastCycleAt: new Date(), running: true }),
        deliverySummary: () => ({ failed: 0, pending: 0 }),
        startedAt: new Date(),
        telegramStatus: () => ({
          connected: telegram.running,
          source: channel === 'telegram' ? 'local' : 'none',
        }),
        vkStatus: () => ({
          connected: vk.running,
          source: channel === 'vk' ? 'local' : 'none',
        }),
      });
      expect(monitoring.isReady()).toBe(false);
      expect(monitoring.getStatus().channels[channel]).toMatchObject({
        running: false,
        consecutiveFailures: 1,
        lastFailure: {
          stage: 'startup',
          request: {
            channel,
            kind: 'transport',
            transportCodes: ['UND_ERR_CONNECT_TIMEOUT'],
          },
        },
      });
      expect(JSON.stringify(monitoring.getStatus())).not.toContain(
        'synthetic-token',
      );
      expect(JSON.stringify(monitoring.getStatus())).not.toContain(
        'private-message',
      );
      expect(registerClientChannel).not.toHaveBeenCalled();
    } finally {
      await telegram.stop();
      await vk.stop();
      repository.close();
    }
  },
);
