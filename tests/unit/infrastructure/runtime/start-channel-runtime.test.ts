import { describe, expect, it, vi } from 'vitest';

import { startChannelRuntime } from '@/infrastructure/runtime/start-channel-runtime.js';

describe('startChannelRuntime', () => {
  it('does nothing when the channel is not configured', async () => {
    const start = vi.fn(() => Promise.resolve());

    await startChannelRuntime({
      channel: 'VK',
      config: undefined,
      logger: { error: vi.fn() },
      runtime: { start },
    });

    expect(start).not.toHaveBeenCalled();
  });

  it('reports a failed external connection without rejecting HTTP startup', async () => {
    const error = new Error('External API is unavailable');
    const logger = { error: vi.fn() };

    await expect(
      startChannelRuntime({
        channel: 'Telegram',
        config: { token: 'synthetic' },
        logger,
        runtime: { start: () => Promise.reject(error) },
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      error,
      'Telegram connection could not be started; HTTP operations remain available',
    );
  });
});
