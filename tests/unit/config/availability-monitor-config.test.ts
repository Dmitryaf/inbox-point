import { describe, expect, it } from 'vitest';

import { loadAvailabilityMonitorConfig } from '@/config/availability-monitor-config.js';

describe('loadAvailabilityMonitorConfig', () => {
  it('requires HTTPS and maps monitor settings without exposing credentials', () => {
    expect(() =>
      loadAvailabilityMonitorConfig({
        MONITOR_ALERT_WEBHOOK_URL: 'https://alerts.example.test/hook',
        MONITOR_READINESS_URL: 'http://example.test/ready',
      }),
    ).toThrow('Availability monitor requires');
    expect(() =>
      loadAvailabilityMonitorConfig({
        MONITOR_ALERT_WEBHOOK_URL: 'https://alerts.example.test/hook',
        MONITOR_READINESS_URL: 'https://example.test/health',
      }),
    ).toThrow('Availability monitor requires');

    const config = loadAvailabilityMonitorConfig({
      MONITOR_ALERT_BEARER_TOKEN: 'synthetic-token',
      MONITOR_ALERT_WEBHOOK_URL: 'https://alerts.example.test/hook',
      MONITOR_INTERVAL_SECONDS: '30',
      MONITOR_READINESS_URL: 'https://example.test/ready',
      MONITOR_TIMEOUT_SECONDS: '5',
    });

    expect(config).toMatchObject({
      intervalMs: 30_000,
      alertBearerToken: 'synthetic-token',
      timeoutMs: 5_000,
    });
    expect(config.readinessUrl.toString()).toBe('https://example.test/ready');
    expect(config.alertWebhookUrl.toString()).toBe(
      'https://alerts.example.test/hook',
    );
  });
});
