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
        incidents: [],
        pending: 2,
        state: 'healthy',
        uncertain: 0,
        worker: {
          lastCycleAt: '2026-09-04T12:01:04.000Z',
          running: true,
          state: 'running',
        },
      },
      intake: {
        telegram: { mode: 'active' },
        vk: { mode: 'active' },
      },
      observedAt: '2026-09-04T12:01:05.000Z',
      outbound: { mode: 'active' },
      startedAt: '2026-09-04T12:00:00.000Z',
      state: 'healthy',
      uptimeSeconds: 65,
    });
  });

  it('reports intentional maintenance separately from a technical failure', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: () => ({
        lastSuccessfulPollAt: new Date('2026-09-04T12:01:00.000Z'),
      }),
      clock: () => new Date('2026-09-04T12:01:05.000Z'),
      deliveryActivity: () => ({
        lastCycleAt: new Date('2026-09-04T12:01:04.000Z'),
        running: true,
      }),
      deliverySummary: () => ({ failed: 0, pending: 0 }),
      intakeStatus: () => ({
        telegram: {
          changedAt: '2026-09-04T12:00:30.000Z',
          mode: 'paused',
        },
        vk: { mode: 'active' },
      }),
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'local' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus()).toMatchObject({
      intake: {
        telegram: { mode: 'paused' },
        vk: { mode: 'active' },
      },
      state: 'maintenance',
    });
    expect(monitoring.isReady()).toBe(true);
  });

  it('reports a paused delivery queue as maintenance instead of backlog', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: () => ({
        lastSuccessfulPollAt: new Date('2026-09-04T12:10:00.000Z'),
      }),
      clock: () => new Date('2026-09-04T12:10:00.000Z'),
      deliveryActivity: () => ({ running: true }),
      deliveryControlStatus: () => ({
        changedAt: '2026-09-04T12:02:00.000Z',
        mode: 'paused',
      }),
      deliverySummary: () => ({
        failed: 0,
        oldestPendingAt: new Date('2026-09-04T12:00:00.000Z'),
        pending: 3,
      }),
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'local' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus()).toMatchObject({
      deliveries: { pending: 3, state: 'paused' },
      outbound: { mode: 'paused' },
      state: 'maintenance',
    });
    expect(monitoring.isReady()).toBe(true);
  });

  it('exposes only operator-side context for failed deliveries', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: () => ({}),
      clock: () => new Date('2026-09-04T12:01:05.000Z'),
      deliveryActivity: () => ({ running: true }),
      deliveryFailures: () => [
        {
          attempts: 5,
          channel: 'vk',
          createdAt: new Date('2026-09-04T12:01:00.000Z'),
          id: 'delivery-1',
          lastError: 'network timeout',
          operatorMessageId: 'operator-message-17',
          operatorTopicId: 'topic-42',
          outcomeUnknown: false,
          requestId: 'request-9',
        },
      ],
      deliverySummary: () => ({ failed: 1, pending: 0 }),
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'local' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus().deliveries.incidents).toEqual([
      {
        attempts: 5,
        channel: 'VK',
        createdAt: '2026-09-04T12:01:00.000Z',
        id: 'delivery-1',
        operatorMessageId: 'operator-message-17',
        operatorTopicId: 'topic-42',
        outcomeUnknown: false,
        reason:
          'Не удалось связаться с каналом. Проверьте интернет и повторите попытку.',
        requestId: 'request-9',
        retryAllowed: true,
      },
    ]);
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
