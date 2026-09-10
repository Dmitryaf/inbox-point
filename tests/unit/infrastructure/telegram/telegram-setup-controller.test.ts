import { describe, expect, it, vi } from 'vitest';

import type { TelegramRuntimeConfig } from '@/config/runtime-config.js';
import type { TelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';
import type { TelegramRuntimeControl } from '@/infrastructure/telegram/telegram-runtime.js';
import {
  TelegramSetupController,
  type TelegramSettingsSource,
} from '@/infrastructure/telegram/telegram-setup-controller.js';

const initialConfig: TelegramRuntimeConfig = {
  botToken: 'initial-synthetic-telegram-token',
  operatorChatId: -1001,
  pollTimeoutSeconds: 30,
};

describe('TelegramSetupController', () => {
  it('stops Telegram before clearing local settings', async () => {
    const harness = createHarness({ running: true, stored: initialConfig });
    await harness.controller.disconnect();
    expect(harness.events).toEqual(['stop', 'clear']);
    expect(harness.stored()).toBeUndefined();
    expect(harness.controller.status()).toEqual({
      connected: false,
      locked: false,
      source: 'none',
    });
  });

  it('keeps persisted settings when stopping Telegram fails', async () => {
    const harness = createHarness({
      running: true,
      stopError: new Error('stop failure'),
      stored: initialConfig,
    });
    await expect(harness.controller.disconnect()).rejects.toThrow(
      'stop failure',
    );
    expect(harness.events).toEqual(['stop']);
    expect(harness.stored()).toEqual(initialConfig);
    expect(harness.controller.status()).toEqual({
      connected: true,
      locked: true,
      source: 'local',
    });
  });

  it('keeps persisted settings and local source when clearing fails', async () => {
    const harness = createHarness({
      clearError: new Error('disk failure'),
      running: true,
      stored: initialConfig,
    });
    await expect(harness.controller.disconnect()).rejects.toThrow(
      'disk failure',
    );
    expect(harness.events).toEqual(['stop', 'clear']);
    expect(harness.stored()).toEqual(initialConfig);
    expect(harness.controller.status()).toEqual({
      connected: false,
      locked: false,
      source: 'local',
    });
  });

  it('treats repeated disconnect as an idempotent success', async () => {
    const harness = createHarness({ running: true, stored: initialConfig });
    await harness.controller.disconnect();
    await harness.controller.disconnect();
    expect(harness.events).toEqual(['stop', 'clear']);
  });

  it('supports connect, disconnect, and connect again with fresh settings', async () => {
    const harness = createHarness({ source: 'none' });
    const replacementConfig: TelegramRuntimeConfig = {
      botToken: 'replacement-synthetic-telegram-token',
      operatorChatId: -2002,
      pollTimeoutSeconds: 30,
    };
    await harness.controller.connect(
      initialConfig.botToken,
      initialConfig.operatorChatId,
    );
    expect(harness.stored()).toEqual(initialConfig);
    await harness.controller.disconnect();
    expect(harness.controller.status().source).toBe('none');
    await harness.controller.connect(
      replacementConfig.botToken,
      replacementConfig.operatorChatId,
    );
    expect(harness.stored()).toEqual(replacementConfig);
    expect(harness.controller.status()).toEqual({
      connected: true,
      locked: true,
      source: 'local',
    });
    expect(harness.events).toEqual([
      'start',
      'save',
      'stop',
      'clear',
      'start',
      'save',
    ]);
  });

  it('rejects disconnect for server-managed settings', async () => {
    const harness = createHarness({
      running: true,
      source: 'environment',
      stored: initialConfig,
    });
    await expect(harness.controller.disconnect()).rejects.toThrow(
      'managed by server configuration',
    );
    expect(harness.events).toEqual([]);
    expect(harness.stored()).toEqual(initialConfig);
  });
});

function createHarness(options: {
  clearError?: Error;
  running?: boolean;
  source?: TelegramSettingsSource;
  stopError?: Error;
  stored?: TelegramRuntimeConfig;
}) {
  const events: string[] = [];
  let running = options.running ?? false;
  let stored = options.stored;
  const runtime: TelegramRuntimeControl = {
    get running() {
      return running;
    },
    start: vi.fn(() => {
      events.push('start');
      running = true;
      return Promise.resolve();
    }),
    stop: vi.fn(() => {
      events.push('stop');
      if (options.stopError) {
        return Promise.reject(options.stopError);
      }
      running = false;
      return Promise.resolve();
    }),
  };
  const settingsStore: TelegramSettingsStore = {
    clear: vi.fn(() => {
      events.push('clear');
      if (options.clearError) {
        return Promise.reject(options.clearError);
      }
      stored = undefined;
      return Promise.resolve();
    }),
    load: vi.fn(() => Promise.resolve(stored)),
    save: vi.fn((settings: TelegramRuntimeConfig) => {
      events.push('save');
      stored = settings;
      return Promise.resolve();
    }),
  };
  return {
    controller: new TelegramSetupController(
      runtime,
      settingsStore,
      options.source ?? 'local',
    ),
    events,
    stored: () => stored,
  };
}
