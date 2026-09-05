import { describe, expect, it, vi } from 'vitest';

import type { ServiceControlStore } from '@/modules/service-control/application/ports/service-control-store.js';
import { ServiceControlService } from '@/modules/service-control/application/service-control-service.js';
import { createDefaultServiceControlState } from '@/modules/service-control/model/service-control-state.js';

describe('ServiceControlService', () => {
  it('persists a channel pause before exposing the change', async () => {
    const { save, store } = createStore();
    const service = new ServiceControlService(
      createDefaultServiceControlState(),
      store,
      () => new Date('2026-09-05T10:00:00.000Z'),
    );

    const paused = await service.pause('telegram');

    expect(paused).toMatchObject({
      channels: {
        telegram: {
          changedAt: '2026-09-05T10:00:00.000Z',
          mode: 'paused',
        },
      },
    });
    expect(service.isPaused('telegram')).toBe(true);
    expect(save).toHaveBeenCalledOnce();
  });

  it('keeps the previous mode when persistence fails', async () => {
    const { save, store } = createStore();
    const service = new ServiceControlService(
      createDefaultServiceControlState(),
      store,
    );
    save.mockRejectedValueOnce(new Error('disk unavailable'));

    await expect(service.pause('telegram')).rejects.toThrow('disk unavailable');
    expect(service.isPaused('telegram')).toBe(false);
  });
});

function createStore() {
  const save = vi.fn<ServiceControlStore['save']>(() => Promise.resolve());
  const store: ServiceControlStore = {
    load: () => Promise.resolve(undefined),
    save,
  };
  return { save, store };
}
