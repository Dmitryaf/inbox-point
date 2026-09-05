import { describe, expect, it } from 'vitest';

import { ChannelActivityMonitor } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';

describe('ChannelActivityMonitor', () => {
  it('keeps separate success and failure timestamps for each channel', () => {
    const monitor = new ChannelActivityMonitor();
    const telegramSuccess = new Date('2026-09-04T12:00:00.000Z');
    const telegramFailure = new Date('2026-09-04T12:01:00.000Z');
    const vkSuccess = new Date('2026-09-04T12:02:00.000Z');

    monitor.recordPollSucceeded('telegram', telegramSuccess);
    monitor.recordPollFailed('telegram', telegramFailure);
    monitor.recordPollerStarted('telegram', telegramSuccess);
    monitor.recordPollerStopped('telegram', telegramFailure);
    monitor.recordPollSucceeded('vk', vkSuccess);

    expect(monitor.snapshot('telegram')).toEqual({
      lastFailedPollAt: telegramFailure,
      lastPollerStartedAt: telegramSuccess,
      lastPollerStoppedAt: telegramFailure,
      lastSuccessfulPollAt: telegramSuccess,
      pollerRunning: false,
    });
    expect(monitor.snapshot('vk')).toEqual({
      lastSuccessfulPollAt: vkSuccess,
    });
  });
});
