import { describe, expect, it, vi } from 'vitest';

import type { VkRuntimeConfig } from '@/config/runtime-config.js';
import type { VkSettingsStore } from '@/infrastructure/persistence/vk-settings-store.js';
import {
  VkSetupController,
  type VkRuntimeControl,
  type VkSettingsSource,
  type VkSetupGateway,
} from '@/infrastructure/vk/vk-setup-controller.js';

const initialConfig: VkRuntimeConfig = {
  accessToken: 'initial-synthetic-vk-access-token',
  groupId: 42,
  pollTimeoutSeconds: 25,
};

describe('VkSetupController', () => {
  it('stops VK before clearing local settings', async () => {
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

  it('keeps persisted settings when stopping VK fails', async () => {
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
    const replacementConfig: VkRuntimeConfig = {
      accessToken: 'replacement-synthetic-vk-access-token',
      groupId: 84,
      pollTimeoutSeconds: 25,
    };
    harness.resolveCommunity
      .mockResolvedValueOnce(initialConfig.groupId)
      .mockResolvedValueOnce(replacementConfig.groupId);

    await harness.controller.connect(initialConfig.accessToken, 'first');
    expect(harness.stored()).toEqual(initialConfig);
    await harness.controller.disconnect();
    expect(harness.controller.status().source).toBe('none');
    await harness.controller.connect(replacementConfig.accessToken, 'second');
    expect(harness.stored()).toEqual(replacementConfig);
    expect(harness.controller.status()).toEqual({
      connected: true,
      locked: true,
      source: 'local',
    });
    expect(harness.events).toEqual([
      'permissions',
      'settings',
      'validate',
      'start',
      'save',
      'stop',
      'clear',
      'permissions',
      'settings',
      'validate',
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

  it('validates Long Poll before starting and saving the connection', async () => {
    const harness = createHarness({ source: 'none' });
    await harness.controller.connect(
      initialConfig.accessToken,
      'https://vk.com/test',
    );
    expect(harness.events).toEqual([
      'permissions',
      'settings',
      'validate',
      'start',
      'save',
    ]);
    expect(harness.stored()).toEqual(initialConfig);
  });

  it('does not start or save an invalid Long Poll configuration', async () => {
    const harness = createHarness({ source: 'none' });
    harness.getLongPollServer.mockRejectedValueOnce(new Error('disabled'));
    await expect(
      harness.controller.connect(initialConfig.accessToken, 'test'),
    ).rejects.toThrow('disabled');
    expect(harness.getLongPollServer).toHaveBeenCalledOnce();
    expect(harness.events).toEqual(['permissions', 'settings']);
    expect(harness.stored()).toBeUndefined();
  });

  it('rejects a key without community management permission', async () => {
    const harness = createHarness({ source: 'none' });
    harness.getTokenPermissions.mockResolvedValueOnce({
      names: ['messages'],
    });

    await expect(
      harness.controller.connect(initialConfig.accessToken, 'test'),
    ).rejects.toThrow('missing manage permission');
    expect(harness.events).toEqual([]);
    expect(harness.getTokenPermissions).toHaveBeenCalledOnce();
    expect(harness.resolveCommunity).not.toHaveBeenCalled();
  });

  it('distinguishes disabled Long Poll from disabled incoming events', async () => {
    const disabled = createHarness({ source: 'none' });
    disabled.getLongPollSettings.mockResolvedValueOnce({
      enabled: false,
      messageNew: true,
    });
    await expect(
      disabled.controller.connect(initialConfig.accessToken, 'test'),
    ).rejects.toThrow('Long Poll is disabled');
    expect(disabled.getLongPollServer).not.toHaveBeenCalled();

    const missingEvent = createHarness({ source: 'none' });
    missingEvent.getLongPollSettings.mockResolvedValueOnce({
      enabled: true,
      messageNew: false,
    });
    await expect(
      missingEvent.controller.connect(initialConfig.accessToken, 'test'),
    ).rejects.toThrow('message_new event is disabled');
    expect(missingEvent.getLongPollServer).not.toHaveBeenCalled();
  });
});

function createHarness(options: {
  clearError?: Error;
  running?: boolean;
  source?: VkSettingsSource;
  stopError?: Error;
  stored?: VkRuntimeConfig;
}) {
  const events: string[] = [];
  let running = options.running ?? false;
  let stored = options.stored;
  const runtime: VkRuntimeControl = {
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
  const settingsStore: VkSettingsStore = {
    clear: vi.fn(() => {
      events.push('clear');
      if (options.clearError) {
        return Promise.reject(options.clearError);
      }
      stored = undefined;
      return Promise.resolve();
    }),
    load: vi.fn(() => Promise.resolve(stored)),
    save: vi.fn((settings: VkRuntimeConfig) => {
      events.push('save');
      stored = settings;
      return Promise.resolve();
    }),
  };
  const getLongPollServer = vi.fn<VkSetupGateway['getLongPollServer']>(() => {
    events.push('validate');
    return Promise.resolve({});
  });
  const getLongPollSettings = vi.fn<VkSetupGateway['getLongPollSettings']>(
    () => {
      events.push('settings');
      return Promise.resolve({ enabled: true, messageNew: true });
    },
  );
  const getTokenPermissions = vi.fn<VkSetupGateway['getTokenPermissions']>(
    () => {
      events.push('permissions');
      return Promise.resolve({ names: ['manage', 'messages'] });
    },
  );
  const resolveCommunity = vi.fn<VkSetupGateway['resolveCommunity']>(() =>
    Promise.resolve(initialConfig.groupId),
  );
  return {
    controller: new VkSetupController(
      runtime,
      settingsStore,
      options.source ?? 'local',
      () => ({
        getLongPollServer,
        getLongPollSettings,
        getTokenPermissions,
        resolveCommunity,
      }),
    ),
    events,
    getLongPollServer,
    getLongPollSettings,
    getTokenPermissions,
    resolveCommunity,
    stored: () => stored,
  };
}
