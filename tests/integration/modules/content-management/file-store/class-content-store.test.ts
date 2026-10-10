import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { classContent } from '@test/support/class-content.js';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import {
  contentInputSchema,
  normalizeContentInput,
} from '@/modules/content-management/presentation/http/content-input.js';
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});
describe('stored class content compatibility', () => {
  it('retains legacy cards, groups and keyword IDs through reload, revisions and restore', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-classes-'));
    directories.push(directory);
    const path = join(directory, 'content.json');
    const store = new FileContentSettingsStore(path);
    const content = classContent();
    await store.save(content);
    const loaded = await new FileContentSettingsStore(path).load();
    expect(loaded?.directions).toEqual(content.directions);
    expect(loaded?.groups?.[0]).toEqual(content.groups![0]);
    expect(loaded?.groups?.[1]?.review?.source).toBe(
      'Старая карточка\nСуббота, 12:00\nСохранённое описание.',
    );
    expect(loaded?.keywords).toEqual(content.keywords);
    expect(loaded?.schedule).toBeUndefined();
    const stored: unknown = JSON.parse(await readFile(path, 'utf8'));
    expect(stored).toHaveProperty('formatVersion', 3);
    // Previous releases used a strict envelope: they must reject new content instead of dropping its fields on save.
    expect(
      z
        .object({
          content: z.unknown(),
          history: z.unknown(),
          previousMenuActions: z.unknown().optional(),
        })
        .strict()
        .safeParse(stored).success,
    ).toBe(false);
    content.groups![0]!.meetings[0] = 'Понедельник, 20:00';
    await store.save(content);
    expect((await store.loadHistory())[0]?.sections).toContain('schedule');
    expect((await store.loadRevision(1))?.groups![0]!.meetings[0]).toContain(
      '19:00',
    );
    expect((await store.restore(1)).groups![0]!.meetings[0]).toContain('19:00');
  });
  it('preserves new settings when an older client saves prices and rejects dangling keyword targets', () => {
    const current = classContent();
    const input = contentInputSchema.parse({
      address: 'Новый адрес',
      prices: '600',
      schedule: '',
      scheduleItems: current.schedule,
    });
    const normalized = normalizeContentInput(input, current);
    expect(normalized?.directions).toEqual(current.directions);
    expect(normalized?.groups).toEqual(current.groups);
    expect(normalized?.keywords).toEqual(current.keywords);
    expect(
      normalizeContentInput({ ...input, groups: [] }, current),
    ).toBeUndefined();
  });
  it('retains unstructured legacy text alongside the new groups', () => {
    const current = { ...classContent(), schedule: [] };
    const normalized = normalizeContentInput(
      contentInputSchema.parse({
        ...current,
        address: '',
        prices: '',
        scheduleItems: [],
        schedule: 'Свободное старое расписание',
      }),
    );
    expect(normalized?.legacySchedule).toBe('Свободное старое расписание');
    expect(normalized?.groups).toHaveLength(1);
  });
});
