import { describe, expect, it } from 'vitest';

import { loadAvailabilityMonitorConfig } from '@/config/availability-monitor-config.js';

describe('loadAvailabilityMonitorConfig', () => {
  it('requires HTTPS and maps monitor settings without exposing credentials', () => {
    expect(() =>
      loadAvailabilityMonitorConfig({
        MONITOR_HEALTH_URL: 'http://example.test/health',
        MONITOR_TELEGRAM_BOT_TOKEN: 'secret-token',
        MONITOR_TELEGRAM_CHAT_ID: '123',
      }),
    ).toThrow('Availability monitor requires');

    const config = loadAvailabilityMonitorConfig({
      MONITOR_HEALTH_URL: 'https://example.test/health',
      MONITOR_INTERVAL_SECONDS: '30',
      MONITOR_TELEGRAM_BOT_TOKEN: 'synthetic-token',
      MONITOR_TELEGRAM_CHAT_ID: '123',
      MONITOR_TIMEOUT_SECONDS: '5',
    });

    expect(config).toMatchObject({
      intervalMs: 30_000,
      telegramBotToken: 'synthetic-token',
      telegramChatId: '123',
      timeoutMs: 5_000,
    });
    expect(config.healthUrl.toString()).toBe('https://example.test/health');
  });
});
