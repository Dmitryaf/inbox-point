import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import {
  ContentManagementService,
  ContentVersionConflictError,
} from '@/modules/content-management/application/content-management-service.js';
import {
  contentInputSchema,
  normalizeContentInput,
} from '@/modules/content-management/presentation/http/content-input.js';

describe('organization identity in content settings', () => {
  it('persists a name-only change, reloads it and restores the recorded name without changing client answers', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-name-'));
    try {
      const path = join(directory, 'content.json');
      const store = new FileContentSettingsStore(path);
      const catalog = new ClientInformationCatalog({ prices: '600' });
      const pricesBefore = catalog.resolve('Цены');
      const service = new ContentManagementService(catalog, store);
      const before = service.get();
      const saved = await service.save(
        { ...before.content, organizationName: 'Школа танцев' },
        before.version,
      );
      expect(saved.content.organizationName).toBe('Школа танцев');
      expect(catalog.resolve('Цены')).toBe(pricesBefore);
      const reloaded = new FileContentSettingsStore(path);
      expect((await reloaded.load())?.organizationName).toBe('Школа танцев');
      expect((await reloaded.loadHistory())[0]?.sections).toContain(
        'organization',
      );
      await expect(
        service.save({ organizationName: 'Другая школа' }, before.version),
      ).rejects.toBeInstanceOf(ContentVersionConflictError);
      await service.save(
        { ...saved.content, organizationName: 'Новое название' },
        saved.version,
      );
      expect(
        (await service.restore(1, service.get().version)).content
          .organizationName,
      ).toBe('Школа танцев');
      const oldClient = contentInputSchema.parse({
        address: '',
        prices: '700',
        schedule: '',
      });
      expect(
        normalizeContentInput(oldClient, service.get().content)
          ?.organizationName,
      ).toBe('Школа танцев');
      const cleared = normalizeContentInput(
        { ...oldClient, organizationName: '  ' },
        service.get().content,
      )!;
      await service.save(cleared, service.get().version);
      expect((await reloaded.load())?.organizationName).toBeUndefined();
    } finally {
      await rm(directory, { recursive: true });
    }
  });
  it('validates the single-line name and normalizes surrounding whitespace', () => {
    const input = {
      address: '',
      prices: '',
      schedule: '',
      organizationName: '  Школа  ',
    };
    expect(
      normalizeContentInput(contentInputSchema.parse(input))?.organizationName,
    ).toBe('Школа');
    for (const name of ['x'.repeat(121), 'Школа\nтанцев']) {
      expect(
        contentInputSchema.safeParse({ ...input, organizationName: name })
          .success,
      ).toBe(false);
    }
  });
});
