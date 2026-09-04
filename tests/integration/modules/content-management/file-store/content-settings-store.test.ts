import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});

describe('FileContentSettingsStore', () => {
  it('persists content and records restorable revisions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const moments = [
      new Date('2026-09-01T12:00:00.000Z'),
      new Date('2026-09-01T12:05:00.000Z'),
    ];
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
      () => moments.shift()!,
    );

    await expect(store.load()).resolves.toBeUndefined();
    await store.save({
      customSections: [
        {
          label: 'First visit',
          text: 'Come ten minutes early.',
        },
      ],
      faq: [
        {
          answer: 'Send a message.',
          question: 'How to join?',
        },
      ],
      prices: 'Single visit: 10',
      schedule: 'Monday: 19:00',
    });
    await store.save({
      address: 'Main street, 1',
      customSections: [
        {
          label: 'First visit',
          text: 'Come ten minutes early.',
        },
      ],
      faq: [
        {
          answer: 'Send a message.',
          question: 'How to join?',
        },
      ],
      prices: 'Single visit: 10',
      schedule: 'Monday: 19:00',
    });

    await expect(store.load()).resolves.toEqual({
      address: 'Main street, 1',
      customSections: [
        {
          label: 'First visit',
          text: 'Come ten minutes early.',
        },
      ],
      faq: [
        {
          answer: 'Send a message.',
          question: 'How to join?',
        },
      ],
      prices: 'Single visit: 10',
      schedule: 'Monday: 19:00',
    });
    await expect(store.loadHistory()).resolves.toEqual([
      {
        changedAt: '2026-09-01T12:05:00.000Z',
        revision: 2,
        sections: ['address'],
      },
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        revision: 1,
        sections: ['schedule', 'prices', 'faq', 'customSections'],
      },
    ]);
  });

  it('reads the previous version without inventing history', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const path = join(directory, 'content-settings.json');
    await writeFile(
      path,
      JSON.stringify({
        schedule: 'Monday: 19:00',
        version: 1,
      }),
      'utf8',
    );
    const store = new FileContentSettingsStore(path);

    await expect(store.load()).resolves.toEqual({
      schedule: 'Monday: 19:00',
    });
    await expect(store.loadHistory()).resolves.toEqual([]);
  });

  it('migrates a version 2 text FAQ into structured items', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const path = join(directory, 'content-settings.json');
    await writeFile(
      path,
      JSON.stringify({
        content: {
          customSections: [
            {
              format: 'faq',
              label: 'FAQ',
              text: 'How to join?\nSend a message.\n\nWhat to bring?\nClean shoes.',
            },
            {
              label: 'First visit',
              text: 'Come ten minutes early.',
            },
          ],
        },
        history: [
          {
            changedAt: '2026-09-01T12:00:00.000Z',
            sections: ['customSections'],
          },
        ],
        version: 2,
      }),
      'utf8',
    );
    const store = new FileContentSettingsStore(path);

    await expect(store.load()).resolves.toEqual({
      customSections: [
        {
          label: 'First visit',
          text: 'Come ten minutes early.',
        },
      ],
      faq: [
        {
          answer: 'Send a message.',
          question: 'How to join?',
        },
        {
          answer: 'Clean shoes.',
          question: 'What to bring?',
        },
      ],
    });
    await expect(store.loadHistory()).resolves.toEqual([
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        sections: ['customSections'],
      },
    ]);
  });

  it('restores an earlier revision and records the restoration as a new change', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const moments = [
      new Date('2026-09-01T12:00:00.000Z'),
      new Date('2026-09-01T12:05:00.000Z'),
      new Date('2026-09-01T12:10:00.000Z'),
    ];
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
      () => moments.shift()!,
    );

    await store.save({ schedule: 'Monday: 19:00' });
    await store.save({ schedule: 'Tuesday: 20:00' });
    await expect(store.restore(1)).resolves.toEqual({
      schedule: 'Monday: 19:00',
    });

    await expect(store.load()).resolves.toEqual({
      schedule: 'Monday: 19:00',
    });
    await expect(store.loadHistory()).resolves.toEqual([
      {
        changedAt: '2026-09-01T12:10:00.000Z',
        revision: 3,
        sections: ['schedule'],
      },
      {
        changedAt: '2026-09-01T12:05:00.000Z',
        revision: 2,
        sections: ['schedule'],
      },
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        revision: 1,
        sections: ['schedule'],
      },
    ]);
  });

  it('keeps version 3 history readable without claiming it is restorable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const path = join(directory, 'content-settings.json');
    await writeFile(
      path,
      JSON.stringify({
        content: { schedule: 'Monday: 19:00' },
        history: [
          {
            changedAt: '2026-09-01T12:00:00.000Z',
            sections: ['schedule'],
          },
        ],
        version: 3,
      }),
      'utf8',
    );
    const store = new FileContentSettingsStore(path);

    await expect(store.loadHistory()).resolves.toEqual([
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        sections: ['schedule'],
      },
    ]);
    await expect(store.restore(1)).rejects.toThrow(
      'The requested content revision is unavailable',
    );
  });
  it('does not add history when content did not change', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'messenger-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
      () => new Date('2026-09-01T12:00:00.000Z'),
    );

    await store.save({ schedule: 'Monday: 19:00' });
    await store.save({ schedule: 'Monday: 19:00' });

    await expect(store.loadHistory()).resolves.toHaveLength(1);
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
