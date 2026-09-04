import { describe, expect, it } from 'vitest';

import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

describe('OperationsMonitoringService', () => {
  it('reports a healthy service when both channels are running', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: () => ({
        lastSuccessfulPollAt: new Date('2026-09-04T12:01:00.000Z'),
      }),
      clock: () => new Date('2026-09-04T12:01:05.000Z'),
      deliverySummary: () => ({ failed: 0, pending: 2 }),
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'environment' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus()).toEqual({
      channels: {
        telegram: {
          configured: true,
          lastSuccessfulPollAt: '2026-09-04T12:01:00.000Z',
          running: true,
          source: 'environment',
          state: 'running',
        },
        vk: {
          configured: true,
          lastSuccessfulPollAt: '2026-09-04T12:01:00.000Z',
          running: true,
          source: 'local',
          state: 'running',
        },
      },
      deliveries: { failed: 0, pending: 2 },
      observedAt: '2026-09-04T12:01:05.000Z',
      startedAt: '2026-09-04T12:00:00.000Z',
      state: 'healthy',
      uptimeSeconds: 65,
    });
  });

  it('requires attention while the latest poll failure is not recovered', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: (channel) => {
        if (channel === 'telegram') {
          return {
            lastFailedPollAt: new Date('2026-09-04T12:01:00.000Z'),
          };
        }
        return {};
      },
      deliverySummary: () => ({ failed: 0, pending: 0 }),
      startedAt: new Date(),
      telegramStatus: () => ({ connected: true, source: 'local' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus().state).toBe('attention');
  });
});
