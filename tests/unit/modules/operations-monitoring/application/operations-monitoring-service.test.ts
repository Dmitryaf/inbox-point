import { describe, expect, it } from 'vitest';

import { OperationsMonitoringService } from '@/modules/operations-monitoring/application/operations-monitoring-service.js';

describe('OperationsMonitoringService', () => {
  it('reports a healthy running service without inventing channel setup', () => {
    const monitoring = new OperationsMonitoringService({
      clock: () => new Date('2026-09-04T12:01:05.000Z'),
      deliverySummary: () => ({ failed: 0, pending: 2 }),
      startedAt: new Date('2026-09-04T12:00:00.000Z'),
      telegramStatus: () => ({ connected: true, source: 'environment' }),
      vkStatus: () => ({ connected: false, source: 'none' }),
    });

    expect(monitoring.getStatus()).toEqual({
      channels: {
        telegram: {
          configured: true,
          running: true,
          source: 'environment',
        },
        vk: { configured: false, running: false, source: 'none' },
      },
      deliveries: { failed: 0, pending: 2 },
      observedAt: '2026-09-04T12:01:05.000Z',
      startedAt: '2026-09-04T12:00:00.000Z',
      state: 'healthy',
      uptimeSeconds: 65,
    });
  });

  it('requires attention for a stopped configured channel or failed delivery', () => {
    const monitoring = new OperationsMonitoringService({
      deliverySummary: () => ({ failed: 1, pending: 0 }),
      startedAt: new Date(),
      telegramStatus: () => ({ connected: false, source: 'local' }),
      vkStatus: () => ({ connected: true, source: 'local' }),
    });

    expect(monitoring.getStatus().state).toBe('attention');
  });
});
