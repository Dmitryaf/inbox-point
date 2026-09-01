import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileVkSettingsStore } from './vk-settings-store.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe('FileVkSettingsStore', () => {
  it('persists and restores local VK settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-handoff-vk-'));
    directories.push(directory);
    const path = join(directory, 'private', 'vk-settings.json');
    const store = new FileVkSettingsStore(path);
    const settings = {
      accessToken: 'synthetic-vk-community-access-token',
      groupId: 42,
      pollTimeoutSeconds: 25,
    };

    await expect(store.load()).resolves.toBeUndefined();
    await store.save(settings);

    await expect(store.load()).resolves.toEqual(settings);
    expect(await readFile(path, 'utf8')).toContain('version');
  });
});
