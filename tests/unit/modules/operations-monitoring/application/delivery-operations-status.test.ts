import { describe, expect, it } from 'vitest';

import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

const observedAt = new Date('2026-09-05T12:10:00.000Z');

describe('delivery operations status', () => {
  it('reports a stalled worker when pending deliveries cannot be processed', () => {
    const monitoring = createMonitoring({
      deliveryActivity: () => ({ running: false }),
      deliverySummary: () => ({
        failed: 0,
        oldestPendingAt: new Date('2026-09-05T12:09:59.000Z'),
        pending: 1,
      }),
    });

    const status = monitoring.getStatus();

    expect(status.deliveries.state).toBe('stalled');
    expect(status.deliveries.worker.state).toBe('stalled');
    expect(monitoring.isReady()).toBe(false);
  });

  it('reports an old queue even while the worker is cycling', () => {
    const monitoring = createMonitoring({
      deliveryActivity: () => ({
        lastCycleAt: new Date('2026-09-05T12:09:59.000Z'),
        running: true,
      }),
      deliverySummary: () => ({
        failed: 0,
        oldestPendingAt: new Date('2026-09-05T12:00:00.000Z'),
        pending: 2,
      }),
    });

    const status = monitoring.getStatus();

    expect(status.deliveries).toMatchObject({
      oldestPendingAgeSeconds: 600,
      state: 'backlog',
      uncertain: 0,
      worker: { state: 'running' },
    });
    expect(monitoring.isReady()).toBe(false);
  });
});

function createMonitoring(
  deliveries: Pick<
    ConstructorParameters<typeof OperationsMonitoringService>[0],
    'deliveryActivity' | 'deliverySummary'
  >,
): OperationsMonitoringService {
  return new OperationsMonitoringService({
    channelActivity: () => ({}),
    clock: () => observedAt,
    pendingDeliveryStaleAfterMs: 300_000,
    startedAt: new Date('2026-09-05T12:00:00.000Z'),
    telegramStatus: () => ({ connected: false, source: 'none' }),
    vkStatus: () => ({ connected: false, source: 'none' }),
    ...deliveries,
  });
}
