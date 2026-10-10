import { formatScheduleCompatibilityText } from '@/core/application/schedule-response.js';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { FileContentSettingsStore } from '@/modules/content-management/infrastructure/file-store/file-content-settings-store.js';
import { ClientInformationCatalog } from '@/core/application/client-information.js';
import { renderClassAction } from '@/core/application/class-navigation.js';
import { migrateSchedule } from '@/modules/content-management/application/schedule-migration.js';
import { classContent } from '@test/support/class-content.js';
const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true })),
  );
});
const schedule = [
  {
    title: 'Бачата парная (начинающие)',
    dayTime: 'День 1, 18:00',
    description: 'Описание первой группы',
  },
  {
    title: 'Бачата парная (продолжающая)',
    dayTime: 'День 2, 20:15',
    description: 'Описание второй группы',
  },
  { title: 'Сальса парная (начинающая)', dayTime: 'День 3, 16:00' },
  { title: 'Сальса парная (продолжающие)', dayTime: 'День 4, 17:30' },
];
async function legacyFile(content: object) {
  const directory = await mkdtemp(join(tmpdir(), 'schedule-migration-'));
  directories.push(directory);
  const path = join(directory, 'content.json');
  const original = JSON.stringify({
    content,
    history: [
      {
        content,
        revision: 7,
        changedAt: '2026-10-01T10:00:00Z',
        sections: ['schedule'],
      },
    ],
  });
  await writeFile(path, original);
  return {
    path,
    directory,
    original,
    store: new FileContentSettingsStore(path),
  };
}
it('migrates the four exact school titles on first read with verified original backup and stable IDs', async () => {
  const fixture = await legacyFile({
    scheduleItems: schedule,
    schedule: formatScheduleCompatibilityText(schedule),
  });
  const content = (await fixture.store.load())!;
  expect(content.directions?.map((item) => item.name)).toEqual([
    'Бачата парная',
    'Сальса парная',
  ]);
  expect(
    content.groups?.map((group) => [
      group.name,
      group.meetings,
      group.description,
      group.enrollmentOpen,
    ]),
  ).toEqual([
    ['Начинающие', [schedule[0]!.dayTime], schedule[0]!.description, false],
    ['Продолжающие', [schedule[1]!.dayTime], schedule[1]!.description, false],
    ['Начинающие', [schedule[2]!.dayTime], '', false],
    ['Продолжающие', [schedule[3]!.dayTime], '', false],
  ]);
  expect(content.schedule).toBeUndefined();
  expect(content.groups?.every((group) => !group.review)).toBe(true);
  const backup = (await readdir(fixture.directory)).find((name) =>
    name.includes('.before-classes-'),
  )!;
  expect(await readFile(join(fixture.directory, backup), 'utf8')).toBe(
    fixture.original,
  );
  const bytes = await readFile(fixture.path, 'utf8');
  expect(await new FileContentSettingsStore(fixture.path).load()).toEqual(
    content,
  );
  expect(await readFile(fixture.path, 'utf8')).toBe(bytes);
  expect(await fixture.store.loadRevision(7)).toEqual(content);
  await fixture.store.save({ ...content, prices: 'Изменённая цена' });
  expect(await fixture.store.restore(7)).toEqual(content);
  expect(
    (await readdir(fixture.directory)).filter((name) =>
      name.includes('.before-classes-'),
    ),
  ).toHaveLength(1);
});
it('retains unknown records and raw text in the same group system and serves them without enrollment', async () => {
  const source = 'Произвольное расписание\nБез потери строк';
  const fixture = await legacyFile({ schedule: source });
  const content = (await fixture.store.load())!;
  expect(content.groups).toEqual([
    expect.objectContaining({
      name: '',
      meetings: [],
      directionId: '',
      enrollmentOpen: false,
      review: { source },
    }),
  ]);
  const catalog = new ClientInformationCatalog(content);
  expect(catalog.getInformationButtons()).toContain('Расписание');
  const response = renderClassAction(catalog, 'classes:review:0');
  expect(response.text).toContain(source);
  expect(
    response.buttons.every((button) => !button.action.includes('signup')),
  ).toBe(true);
  expect(
    renderClassAction(catalog, 'classes:signup:' + content.groups![0]!.id)
      .beginQuestion,
  ).toBeUndefined();
  const unknown = migrateSchedule({
    schedule: [
      {
        title: 'Бачата парная (новички)',
        dayTime: 'Пятница 11:00',
        description: 'Сохранить',
      },
    ],
  });
  expect(unknown.groups?.[0]?.review?.source).toBe(
    'Бачата парная (новички)\nПятница 11:00\nСохранить',
  );
});
it('preserves existing group IDs, words and edited data, isolates collisions and consumes only exact duplicates', () => {
  const original = classContent();
  original.directions![0]!.name = 'Бачата парная';
  original.schedule = [
    schedule[0]!,
    {
      ...schedule[0]!,
      dayTime: original.groups![0]!.meetings[0]!,
      description: original.groups![0]!.description,
    },
  ];
  const result = migrateSchedule(original);
  expect(result.groups?.[0]).toEqual(original.groups![0]);
  expect(result.keywords).toEqual(original.keywords);
  expect(result.groups).toHaveLength(2);
  expect(result.groups?.[1]?.review?.source).toBe(
    [schedule[0]!.title, schedule[0]!.dayTime, schedule[0]!.description].join(
      '\n',
    ),
  );
  expect(migrateSchedule(result)).toEqual(result);
});
it('leaves the source untouched when its existing backup cannot be verified', async () => {
  const fixture = await legacyFile({
    scheduleItems: schedule,
    schedule: formatScheduleCompatibilityText(schedule),
  });
  const hash = createHash('sha256').update(fixture.original).digest('hex');
  await writeFile(
    fixture.path + '.before-classes-' + hash + '.json',
    'different bytes',
  );
  await expect(fixture.store.load()).rejects.toThrow('Unable to read');
  expect(await readFile(fixture.path, 'utf8')).toBe(fixture.original);
});
