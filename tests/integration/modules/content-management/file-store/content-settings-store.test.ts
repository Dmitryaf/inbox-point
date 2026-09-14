import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
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

  it('rejects an outdated local content format', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
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
      }),
      'utf8',
    );
    const store = new FileContentSettingsStore(path);

    await expect(store.load()).rejects.toThrow(
      'The local content settings are invalid',
    );
  });

  it('restores an earlier revision and records the restoration as a new change', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
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

  it('does not add history when content did not change', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
      () => new Date('2026-09-01T12:00:00.000Z'),
    );

    await store.save({ schedule: 'Monday: 19:00' });
    await store.save({ schedule: 'Monday: 19:00' });

    await expect(store.loadHistory()).resolves.toHaveLength(1);
  });

  it('derives deduplicated historical actions from retained revisions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const path = join(directory, 'content-settings.json');
    const store = new FileContentSettingsStore(path);

    await store.save({
      customSections: [
        { label: 'Абонементы', text: 'Первый ответ.' },
        { label: 'Документы', text: 'Что взять с собой.' },
      ],
    });
    await store.save({
      customSections: [{ label: 'Стоимость', text: 'Второй ответ.' }],
    });
    await store.save({
      customSections: [{ label: 'Стоимость', text: 'Уточнённый ответ.' }],
    });
    await store.save({
      customSections: [{ label: 'Цены занятий', text: 'Текущий ответ.' }],
    });

    await expect(store.loadHistoricalMenuActions()).resolves.toEqual([
      'Стоимость',
      'Абонементы',
      'Документы',
    ]);
    expect(JSON.parse(await readFile(path, 'utf8'))).not.toHaveProperty(
      'previousMenuActions',
    );
  });

  it('limits historical actions to the retained content revisions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
    );

    await store.save({
      customSections: [{ label: 'Старая кнопка', text: 'Первый ответ.' }],
    });
    await store.save({
      customSections: [{ label: 'Текущая кнопка', text: 'Первый ответ.' }],
    });
    for (let index = 0; index < 20; index += 1) {
      await store.save({
        customSections: [
          { label: 'Текущая кнопка', text: `Версия ответа ${index}.` },
        ],
      });
    }

    await expect(store.loadHistoricalMenuActions()).resolves.toEqual([]);
    await expect(store.loadHistory()).resolves.toHaveLength(20);
  });

  it('reads the legacy previous-menu field without writing it again', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const path = join(directory, 'content-settings.json');
    await writeFile(
      path,
      JSON.stringify({
        content: {
          customSections: [{ label: 'Текущая кнопка', text: 'Ответ.' }],
        },
        history: [
          {
            changedAt: '2026-09-01T12:00:00.000Z',
            content: {
              customSections: [{ label: 'Текущая кнопка', text: 'Ответ.' }],
            },
            revision: 1,
            sections: ['customSections'],
          },
        ],
        previousMenuActions: ['Старая кнопка'],
      }),
      'utf8',
    );
    const store = new FileContentSettingsStore(path);

    await expect(store.loadHistoricalMenuActions()).resolves.toEqual([
      'Старая кнопка',
    ]);
    await store.save({
      customSections: [{ label: 'Текущая кнопка', text: 'Новый ответ.' }],
    });
    expect(JSON.parse(await readFile(path, 'utf8'))).not.toHaveProperty(
      'previousMenuActions',
    );
  });

  it('gives a reused or unhidden current action priority over history', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
    );

    await store.save({ schedule: 'Понедельник, 19:00' });
    await store.save({
      schedule: 'Понедельник, 19:00',
      visibleSections: ['prices', 'address', 'faq'],
    });
    await expect(store.loadHistoricalMenuActions()).resolves.toEqual([
      'Расписание',
    ]);

    await store.save({
      schedule: 'Понедельник, 19:00',
      visibleSections: ['schedule', 'prices', 'address', 'faq'],
    });
    await expect(store.loadHistoricalMenuActions()).resolves.toEqual([]);
  });

  it('recomputes historical actions when restoring an old revision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
    );

    await store.save({
      customSections: [{ label: 'Абонементы', text: 'Первый ответ.' }],
    });
    await store.save({
      customSections: [{ label: 'Стоимость', text: 'Второй ответ.' }],
    });
    await store.save({
      customSections: [{ label: 'Цены занятий', text: 'Третий ответ.' }],
    });
    await store.restore(1);

    await expect(store.load()).resolves.toEqual({
      customSections: [{ label: 'Абонементы', text: 'Первый ответ.' }],
    });
    await expect(store.loadHistoricalMenuActions()).resolves.toEqual([
      'Цены занятий',
      'Стоимость',
    ]);
  });

  it('persists menu visibility independently from section content', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const moments = [
      new Date('2026-09-01T12:00:00.000Z'),
      new Date('2026-09-01T12:05:00.000Z'),
    ];
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
      () => moments.shift()!,
    );

    await store.save({
      prices: 'Single visit: 10',
      visibleSections: ['schedule', 'prices', 'address', 'faq'],
    });
    await store.save({
      prices: 'Single visit: 10',
      visibleSections: ['schedule', 'address', 'faq'],
    });

    await expect(store.load()).resolves.toEqual({
      prices: 'Single visit: 10',
      visibleSections: ['schedule', 'address', 'faq'],
    });
    await expect(store.loadHistory()).resolves.toEqual([
      {
        changedAt: '2026-09-01T12:05:00.000Z',
        revision: 2,
        sections: ['visibility'],
      },
      {
        changedAt: '2026-09-01T12:00:00.000Z',
        revision: 1,
        sections: ['prices'],
      },
    ]);
  });

  it('rejects content that exceeds the supported message size', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'inbox-point-content-'));
    directories.push(directory);
    const store = new FileContentSettingsStore(
      join(directory, 'content-settings.json'),
    );

    await expect(store.save({ schedule: 'x'.repeat(4_001) })).rejects.toThrow();
    await expect(
      store.save({
        schedule: Array.from({ length: 2_000 }, () => 'x').join('\n'),
      }),
    ).rejects.toThrow();
  });
});
