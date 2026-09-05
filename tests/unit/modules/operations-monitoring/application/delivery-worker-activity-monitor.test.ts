import { describe, expect, it } from 'vitest';

import { DeliveryWorkerActivityMonitor } from '@/modules/operations-monitoring/application/delivery-worker-activity-monitor.js';

describe('DeliveryWorkerActivityMonitor', () => {
  it('reports worker lifecycle and its latest completed cycle', () => {
    const monitor = new DeliveryWorkerActivityMonitor();
    const startedAt = new Date('2026-09-05T12:00:00.000Z');
    const cycleAt = new Date('2026-09-05T12:00:01.000Z');
    const stoppedAt = new Date('2026-09-05T12:00:02.000Z');

    monitor.recordWorkerStarted(startedAt);
    monitor.recordWorkerCycle(cycleAt);
    monitor.recordWorkerStopped(stoppedAt);

    expect(monitor.snapshot()).toEqual({
      lastCycleAt: cycleAt,
      lastStartedAt: startedAt,
      lastStoppedAt: stoppedAt,
      running: false,
    });
  });
});
