import { describe, expect, it } from 'vitest';

import { ClientInformationCatalog } from '@/core/application/client-information.js';
import {
  ContentManagementService,
  ContentVersionConflictError,
} from '@/modules/content-management/application/content-management-service.js';
import type { ContentSettingsStore } from '@/modules/content-management/application/ports/content-settings-store.js';

describe('ContentManagementService', () => {
  it('accepts only one of two saves based on the same content version', async () => {
    const saved: unknown[] = [];
    const store: ContentSettingsStore = {
      load: () => Promise.resolve(undefined),
      loadHistory: () => Promise.resolve([]),
      restore: () => Promise.reject(new Error('not used')),
      save: (content) => {
        saved.push(content);
        return Promise.resolve();
      },
    };
    const catalog = new ClientInformationCatalog();
    const service = new ContentManagementService(catalog, store);
    const initialVersion = service.get().version;

    const results = await Promise.allSettled([
      service.save({ schedule: 'Первое расписание' }, initialVersion),
      service.save({ schedule: 'Второе расписание' }, initialVersion),
    ]);

    expect(results[0]?.status).toBe('fulfilled');
    const secondResult = results[1];
    if (!secondResult) {
      throw new Error('Expected the second save result');
    }
    if (secondResult.status !== 'rejected') {
      throw new Error('Expected the second save to be rejected');
    }
    expect(secondResult.reason).toBeInstanceOf(ContentVersionConflictError);
    expect(saved).toEqual([{ schedule: 'Первое расписание' }]);
    expect(service.get().content).toEqual({ schedule: 'Первое расписание' });
  });
});
