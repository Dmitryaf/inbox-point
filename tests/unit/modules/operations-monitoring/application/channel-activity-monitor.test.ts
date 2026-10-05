import { describe, expect, it, vi } from 'vitest';

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
      consecutiveFailures: 1,
      lastFailure: { stage: 'poll' },
      lastFailedPollAt: telegramFailure,
      lastPollerStartedAt: telegramSuccess,
      lastPollerStoppedAt: telegramFailure,
      lastSuccessfulPollAt: telegramSuccess,
      pollerRunning: false,
    });
    expect(monitor.snapshot('vk')).toEqual({
      consecutiveFailures: 0,
      lastSuccessfulPollAt: vkSuccess,
    });
  });

  it('counts failures across startup and polling and records one recovery', () => {
    const recovered = vi.fn();
    const monitor = new ChannelActivityMonitor(recovered);
    const failedAt = new Date('2026-10-05T12:00:00Z');
    const recoveredAt = new Date('2026-10-05T12:03:00Z');
    monitor.recordPollFailed('telegram', failedAt, { stage: 'startup' });
    monitor.recordPollerStarted('telegram', failedAt);
    monitor.recordPollFailed('telegram', failedAt);
    expect(monitor.snapshot('telegram').consecutiveFailures).toBe(2);
    expect(monitor.snapshot('vk')).toEqual({});
    monitor.recordPollSucceeded('telegram', recoveredAt);
    monitor.recordPollSucceeded('telegram', recoveredAt);
    expect(monitor.snapshot('telegram')).toMatchObject({
      consecutiveFailures: 0,
      lastRecoveredAt: recoveredAt,
      lastFailure: { stage: 'poll' },
    });
    expect(recovered).toHaveBeenCalledExactlyOnceWith({
      channel: 'telegram',
      failureCount: 2,
      recoveredAt: recoveredAt.toISOString(),
    });
    const copy = monitor.snapshot('telegram');
    if (copy.lastFailure) {
      copy.lastFailure.stage = 'startup';
    }
    expect(monitor.snapshot('telegram').lastFailure?.stage).toBe('poll');
  });
});
