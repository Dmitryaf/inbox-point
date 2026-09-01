import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileContentSettingsStore } from './content-settings-store.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe('FileContentSettingsStore', () => {
  it('persists only provided information and restores it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'private', 'content-settings.json'),
    );

    await expect(store.load()).resolves.toBeUndefined();
    await store.save({
      customSections: [
        { label: 'First visit', text: 'Arrive ten minutes early' },
      ],
      prices: 'Single visit: 10',
      schedule: 'Monday: 19:00',
    });

    await expect(store.load()).resolves.toEqual({
      customSections: [
        { label: 'First visit', text: 'Arrive ten minutes early' },
      ],
      prices: 'Single visit: 10',
      schedule: 'Monday: 19:00',
    });
  });

  it('rejects content that exceeds the supported message size', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
    );

    await expect(store.save({ schedule: 'x'.repeat(4_001) })).rejects.toThrow();
  });
});
