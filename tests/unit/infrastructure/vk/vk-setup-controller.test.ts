import { describe, expect, it, vi } from 'vitest';

import type { VkRuntimeConfig } from '@/config/runtime-config.js';
import type { VkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';
import {
  VkSetupController,
  type VkRuntimeControl,
  type VkSetupGateway,
} from '@/infrastructure/vk/vk-setup-controller.js';

describe('VkSetupController', () => {
  it('validates Long Poll before starting and saving the connection', async () => {
    const events: string[] = [];
    const start = vi.fn(() => {
      events.push('start');
      return Promise.resolve();
    });
    const save = vi.fn(() => {
      events.push('save');
      return Promise.resolve();
    });
    const config: VkRuntimeConfig = {
      accessToken: 'synthetic-vk-access-token',
      groupId: 42,
      pollTimeoutSeconds: 25,
    };
    const runtime: VkRuntimeControl = {
      running: false,
      start,
      stop: vi.fn(() => Promise.resolve()),
    };
    const settingsStore: VkSettingsStore = {
      load: vi.fn(() => Promise.resolve(undefined)),
      save,
    };
    const gateway: VkSetupGateway = {
      getLongPollServer: vi.fn(() => {
        events.push('validate');
        return Promise.resolve({});
      }),
      resolveCommunity: vi.fn(() => Promise.resolve(42)),
    };
    const controller = new VkSetupController(
      runtime,
      settingsStore,
      'none',
      () => gateway,
    );

    await controller.connect(config.accessToken, 'https://vk.com/test');

    expect(events).toEqual(['validate', 'start', 'save']);
    expect(start).toHaveBeenCalledWith(config);
    expect(save).toHaveBeenCalledWith(config);
  });

  it('does not start or save an invalid Long Poll configuration', async () => {
    const start = vi.fn(() => Promise.resolve());
    const save = vi.fn(() => Promise.resolve());
    const runtime: VkRuntimeControl = {
      running: false,
      start,
      stop: vi.fn(() => Promise.resolve()),
    };
    const settingsStore: VkSettingsStore = {
      load: vi.fn(() => Promise.resolve(undefined)),
      save,
    };
    const gateway: VkSetupGateway = {
      getLongPollServer: vi.fn(() => Promise.reject(new Error('disabled'))),
      resolveCommunity: vi.fn(() => Promise.resolve(42)),
    };
    const controller = new VkSetupController(
      runtime,
      settingsStore,
      'none',
      () => gateway,
    );

    await expect(
      controller.connect('synthetic-vk-access-token', 'test'),
    ).rejects.toThrow('disabled');
    expect(start).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
