import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classContent } from '@test/support/class-content.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import { serializeContentDocument } from '@/modules/content-management/infrastructure/file-store/document-codec.js';
import {
  contentInputSchema,
  normalizeContentInput,
} from '@/modules/content-management/presentation/http/content-input.js';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});
describe('group-only keywords and historical compatibility', () => {
  const legacyWord = {
    phrase: 'Все группы',
    targetType: 'direction',
    targetId: 'dance',
  } as const;
  it('rejects a newly submitted direction keyword and removes legacy words when an older client omits them', () => {
    const current = {
      ...classContent(),
      schedule: [],
      keywords: [...classContent().keywords!, legacyWord],
    };
    const input = {
      address: '',
      prices: '600',
      schedule: '',
      scheduleItems: [],
    };
    expect(
      contentInputSchema.safeParse({ ...input, keywords: [legacyWord] })
        .success,
    ).toBe(false);
    const normalized = normalizeContentInput(
      contentInputSchema.parse(input),
      current,
    );
    expect(normalized?.keywords).toEqual(classContent().keywords);
    expect(normalized?.groups).toEqual(current.groups);
    expect(current.keywords).toHaveLength(2);
  });
  it('reads old documents and revisions but saving or restoring keeps only group words', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-group-words-'));
    directories.push(directory);
    const path = join(directory, 'content.json');
    const content = {
      ...classContent(),
      schedule: [],
      keywords: [...classContent().keywords!, legacyWord],
    };
    await writeFile(
      path,
      serializeContentDocument({
        content,
        history: [
          {
            content,
            revision: 1,
            sections: ['schedule'],
            changedAt: '2026-10-11T10:00:00.000Z',
          },
        ],
      }),
    );
    const store = new FileContentSettingsStore(path);
    expect((await store.load())?.keywords).toEqual(content.keywords);
    expect((await store.loadRevision(1))?.keywords).toEqual(content.keywords);
    await store.save({ ...content, prices: '700' });
    expect((await new FileContentSettingsStore(path).load())?.keywords).toEqual(
      classContent().keywords,
    );
    const restored = await store.restore(1);
    expect(restored.keywords).toEqual(classContent().keywords);
    expect(restored.groups).toEqual(content.groups);
    expect(restored.prices).toBe(content.prices);
    expect((await store.load())?.keywords).toEqual(restored.keywords);
    expect((await store.loadRevision(1))?.keywords).toEqual(content.keywords);
  });
});
