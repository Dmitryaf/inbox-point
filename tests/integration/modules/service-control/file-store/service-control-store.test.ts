import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { FileServiceControlStore } from '@/modules/service-control/infrastructure/file-store/file-service-control-store.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('FileServiceControlStore', () => {
  it('restores a paused channel after a service restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-'));
    temporaryDirectories.push(directory);
    const store = new FileServiceControlStore(
      join(directory, 'service-control.json'),
    );

    await store.save({
      channels: {
        telegram: {
          changedAt: '2026-09-05T10:00:00.000Z',
          mode: 'paused',
        },
        vk: { mode: 'active' },
      },
      delivery: { mode: 'active' },
    });

    await expect(store.load()).resolves.toEqual({
      channels: {
        telegram: {
          changedAt: '2026-09-05T10:00:00.000Z',
          mode: 'paused',
        },
        vk: { mode: 'active' },
      },
      delivery: { mode: 'active' },
    });
  });

  it('rejects an incomplete local state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'service-control.json');
    await writeFile(
      path,
      JSON.stringify({
        channels: {
          telegram: { mode: 'active' },
          vk: { mode: 'paused' },
        },
      }),
    );

    const store = new FileServiceControlStore(path);

    await expect(store.load()).rejects.toThrow(
      'The local service control settings are invalid',
    );
  });
});
