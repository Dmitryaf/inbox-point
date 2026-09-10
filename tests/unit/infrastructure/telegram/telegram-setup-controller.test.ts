import { describe, expect, it, vi } from 'vitest';

import { TelegramSetupController } from '@/infrastructure/telegram/telegram-setup-controller.js';

describe('TelegramSetupController', () => {
  it('clears local settings and stops Telegram on disconnect', async () => {
    let running = true;
    const clear = vi.fn(() => Promise.resolve());
    const stop = vi.fn(() => {
      running = false;
      return Promise.resolve();
    });
    const controller = new TelegramSetupController(
      {
        get running() {
          return running;
        },
        start: vi.fn(() => Promise.resolve()),
        stop,
      },
      {
        clear,
        load: vi.fn(() => Promise.resolve(undefined)),
        save: vi.fn(() => Promise.resolve()),
      },
      'local',
    );

    await controller.disconnect();

    expect(clear).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(controller.status()).toEqual({
      connected: false,
      locked: false,
      source: 'none',
    });
  });

  it('rejects disconnect for server-managed settings', async () => {
    const stop = vi.fn(() => Promise.resolve());
    const controller = new TelegramSetupController(
      { running: true, start: vi.fn(() => Promise.resolve()), stop },
      {
        clear: vi.fn(() => Promise.resolve()),
        load: vi.fn(() => Promise.resolve(undefined)),
        save: vi.fn(() => Promise.resolve()),
      },
      'environment',
    );

    await expect(controller.disconnect()).rejects.toThrow(
      'managed by server configuration',
    );
    expect(stop).not.toHaveBeenCalled();
  });
});
