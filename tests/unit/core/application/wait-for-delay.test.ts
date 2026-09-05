import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitForDelay } from '@/core/application/wait-for-delay.js';

afterEach(() => vi.useRealTimers());

describe('waitForDelay', () => {
  it('removes the abort listener after a normal timeout', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');

    const waiting = waitForDelay(1_000, controller.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    await waiting;

    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('finishes immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      waitForDelay(1_000, controller.signal),
    ).resolves.toBeUndefined();
  });
});
