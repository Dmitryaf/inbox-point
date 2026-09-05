import { describe, expect, it } from 'vitest';

import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

describe('channel runtime status', () => {
  it('does not report a channel as running after its poller stopped', () => {
    const monitoring = new OperationsMonitoringService({
      channelActivity: (channel) =>
        channel === 'telegram' ? { pollerRunning: false } : {},
      clock: () => new Date('2026-09-05T12:01:00.000Z'),
      deliveryActivity: () => ({ running: false }),
      deliverySummary: () => ({ failed: 0, pending: 0 }),
      startedAt: new Date('2026-09-05T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'environment' }),
      vkStatus: () => ({ connected: false, source: 'none' }),
    });

    const status = monitoring.getStatus();

    expect(status.channels.telegram.running).toBe(false);
    expect(status.channels.telegram.state).toBe('stopped');
    expect(status.state).toBe('attention');
    expect(monitoring.isReady()).toBe(false);
  });
});
