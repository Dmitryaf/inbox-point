import { describe, expect, it } from 'vitest';

import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

describe('OperationsMonitoringService', () => {
  it('reports a healthy service when both channels are running', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: () => ({
        lastSuccessfulPollAt: new Date('2026-09-04T12:01:00.000Z'),
      }),
      clock: () => new Date('2026-09-04T12:01:05.000Z'),
      deliveryActivity: () => ({
        lastCycleAt: new Date('2026-09-04T12:01:04.000Z'),
        running: true,
      }),
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
      deliveries: {
        failed: 0,
        pending: 2,
        state: 'healthy',
        uncertain: 0,
        worker: {
          lastCycleAt: '2026-09-04T12:01:04.000Z',
          running: true,
          state: 'running',
        },
      },
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
      deliveryActivity: () => ({ running: false }),
      startedAt: new Date(),
      telegramStatus: () => ({ connected: true, source: 'local' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus().state).toBe('attention');
    expect(monitoring.isReady()).toBe(false);
  });

  it('allows a bounded startup period before the first successful poll', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: () => ({}),
      clock: () => new Date('2026-09-04T12:01:00.000Z'),
      deliverySummary: () => ({ failed: 0, pending: 0 }),
      deliveryActivity: () => ({ running: false }),
      pollStaleAfterMs: 120_000,
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'environment' }),
      vkStatus: () => ({ connected: true, source: 'environment' }),
    });

    const status = monitoring.getStatus();

    expect(status.channels.telegram.state).toBe('starting');
    expect(status.channels.vk.state).toBe('starting');
    expect(status.state).toBe('healthy');
    expect(monitoring.isReady()).toBe(true);
  });

  it('marks a configured channel as stale after the grace period', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: (channel) => {
        if (channel === 'telegram') {
          return {
            lastSuccessfulPollAt: new Date('2026-09-04T12:00:00.000Z'),
          };
        }
        return {};
      },
      clock: () => new Date('2026-09-04T12:02:01.000Z'),
      deliverySummary: () => ({ failed: 0, pending: 0 }),
      deliveryActivity: () => ({ running: false }),
      pollStaleAfterMs: 120_000,
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'environment' }),
      vkStatus: () => ({ connected: false, source: 'none' }),
    });

    const status = monitoring.getStatus();

    expect(status.channels.telegram.state).toBe('poll_stale');
    expect(status.state).toBe('attention');
    expect(monitoring.isReady()).toBe(false);
  });
});
