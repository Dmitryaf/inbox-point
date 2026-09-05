import { describe, expect, it, vi } from 'vitest';

import { AvailabilityMonitor } from '@/modules/operations-monitoring/application/availability-monitor.js';

describe('AvailabilityMonitor', () => {
  it('alerts once during an outage and reports recovery', async () => {
    const check = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('still unavailable'))
      .mockResolvedValueOnce();
    const send = vi.fn<() => Promise<void>>().mockResolvedValue();
    const monitor = new AvailabilityMonitor(
      { check },
      { send },
      { error: vi.fn(), info: vi.fn() },
      60_000,
    );

    await monitor.checkOnce();
    await monitor.checkOnce();
    await monitor.checkOnce();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(
      1,
      'Messenger Handoff недоступен. Проверьте сервер и контейнер приложения.',
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      'Messenger Handoff снова доступен.',
    );
  });

  it('retries the outage alert when alert delivery itself fails', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };
    const send = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error('alert unavailable'));
    const monitor = new AvailabilityMonitor(
      { check: () => Promise.reject(new Error('unavailable')) },
      { send },
      logger,
      60_000,
    );

    await expect(monitor.checkOnce()).resolves.toBeUndefined();
    await expect(monitor.checkOnce()).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledTimes(4);
  });
});
