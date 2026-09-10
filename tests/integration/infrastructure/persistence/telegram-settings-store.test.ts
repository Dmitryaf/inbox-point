import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileTelegramSettingsStore } from '@/infrastructure/persistence/telegram-settings-store.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe('FileTelegramSettingsStore', () => {
  it('persists and restores local Telegram settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-'));
    directories.push(directory);
    const path = join(directory, 'private', 'telegram-settings.json');
    const store = new FileTelegramSettingsStore(path);
    const settings = {
      botToken: '123456789:synthetic-token-for-settings',
      operatorChatId: -1001,
      pollTimeoutSeconds: 30,
    };

    await expect(store.load()).resolves.toBeUndefined();
    await store.save(settings);

    await expect(new FileTelegramSettingsStore(path).load()).resolves.toEqual(
      settings,
    );
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(settings);

    await store.clear();
    await expect(store.load()).resolves.toBeUndefined();
    await expect(store.clear()).resolves.toBeUndefined();
  });
});
