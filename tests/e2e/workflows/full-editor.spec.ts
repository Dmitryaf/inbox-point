import { editorSection, editorView } from './support/navigation.js';
import { expect, test } from '@playwright/test';
import { login } from './support/auth.js';
import {
  contentBase,
  readContent,
  writeContent,
  saveEditor,
  openGroup,
  currentRevision,
  reviewRevision,
  type ContentSnapshot,
} from './support/content.js';

test.describe.configure({ mode: 'default' });
let initial: ContentSnapshot | undefined;
test.beforeEach(async ({ page }, testInfo) => {
  await login(page, `${contentBase}/manage`);
  const current = await readContent(page);
  initial ??= current;
  await writeContent(page, {
    ...current,
    content: {
      ...initial.content,
      organizationName: `Учебная организация ${testInfo.testId.slice(-10)}`,
    },
  });
  await page.reload();
  await expect(page.getByLabel('Название организации')).toBeVisible();
});

for (const width of [390, 1280]) {
  test(`class creation, enrollment, keywords and reload retain IDs at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const before = await readContent(page);
    await page.getByRole('button', { name: 'Добавить направление' }).click();
    await page
      .getByLabel('Новое направление', { exact: true })
      .fill('Тестовый танец');
    await page.getByRole('button', { name: 'Создать направление' }).click();
    const directionId = (await page
      .getByLabel('Название направления')
      .getAttribute('id'))!.slice('direction-'.length);
    await page.getByRole('button', { name: 'Добавить группу' }).click();
    const groupId = (await page
      .getByLabel('Название группы')
      .getAttribute('id'))!.slice('group-name-'.length);
    await page
      .getByLabel('Название группы')
      .fill('Начинающие на новом направлении');
    await page
      .getByLabel('Дни и время занятий')
      .fill('Понедельник, 19:00\nЧетверг, 19:00');
    await page
      .getByLabel('Короткое описание группы')
      .fill(
        'Длинное описание группы для проверки переноса текста и сохранности полей после повторного открытия.',
      );
    await page.getByLabel('Открыть набор в группу').check();
    await page
      .getByLabel('Вопрос клиенту для записи')
      .fill('Когда хотите прийти?');
    await page
      .getByLabel('Ответ после подтверждения записи')
      .fill('Запись подтверждена!');
    await page.getByRole('button', { name: 'Добавить ключевое слово' }).click();
    await page.getByLabel('Слово или фраза 1').fill('Тестовый танец');
    await page.getByRole('button', { name: 'Посмотреть как клиент' }).click();
    const preview = page.getByLabel('Пример переписки');
    await expect(preview).toContainText('Понедельник, 19:00');
    await preview
      .getByRole('button', { name: 'Записаться на занятие' })
      .click();
    await expect(preview).toContainText('Когда хотите прийти?');
    await saveEditor(page);
    const after = await readContent(page);
    expect(
      after.content.groups!.find((group) => group.id === groupId),
    ).toMatchObject({
      directionId,
      enrollmentOpen: true,
      confirmationText: 'Запись подтверждена!',
      meetings: ['Понедельник, 19:00', 'Четверг, 19:00'],
    });
    expect(
      after.content.groups!.find((group) => group.id === 'review'),
    ).toEqual(before.content.groups!.find((group) => group.id === 'review'));
    expect(after.content.keywords).toContainEqual({
      phrase: 'Тестовый танец',
      targetType: 'group',
      targetId: groupId,
    });
    expect(after.content.customSections).toEqual(before.content.customSections);
    await page.reload();
    await page.getByRole('button', { name: /^Тестовый танец/ }).click();
    await page
      .getByRole('button', { name: /^Начинающие на новом направлении/ })
      .click();
    await expect(
      page.getByLabel('Ответ после подтверждения записи'),
    ).toHaveValue('Запись подтверждена!');
    await expect(page.getByLabel('Дни и время занятий')).toHaveValue(
      'Понедельник, 19:00\nЧетверг, 19:00',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`react-group-${width}.png`),
      fullPage: true,
    });
  });
}

test('custom sections keep identity through purpose changes and keyboard reordering', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const before = await readContent(page);
  await editorSection(page, 'custom');
  await page.getByRole('button', { name: 'Добавить раздел' }).click();
  await expect(page.locator('#section-label-1')).toBeFocused();
  await page.locator('#section-label-1').fill('Заказать звонок');
  const card = page
    .locator('fieldset')
    .filter({ has: page.locator('#section-label-1') });
  await card.getByLabel('Принять заявку', { exact: false }).check();
  await card
    .getByLabel('Что спросить у клиента?')
    .fill('Когда удобно позвонить?');
  await page.getByRole('button', { name: 'Переместить раздел 2 выше' }).click();
  await expect(page.locator('#section-label-0')).toHaveValue('Заказать звонок');
  await editorView(page, 'preview');
  const preview = page.getByLabel('Пример переписки');
  await preview.getByRole('button', { name: 'Заказать звонок' }).click();
  await expect(preview).toContainText('как заявка «Заказать звонок»');
  await saveEditor(page);
  const after = await readContent(page);
  expect(after.content.customSections![1]).toEqual(
    before.content.customSections![0],
  );
  expect(after.content.customSections![0]).toMatchObject({
    mode: 'application',
    label: 'Заказать звонок',
    text: 'Когда удобно позвонить?',
  });
  expect(after.content.customSections![0]!.id).toBeTruthy();
  await page.reload();
  await editorSection(page, 'custom');
  await expect(page.locator('#section-text-0')).toHaveValue(
    'Когда удобно позвонить?',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('react-custom-390.png'),
    fullPage: true,
  });
});

for (const pendingInput of [false, true]) {
  test(`restore applies a complete historical document and preserves concurrent input=${pendingInput}`, async ({
    page,
  }) => {
    const before = await readContent(page);
    const revision = await currentRevision(page);
    await openGroup(page);
    await page.getByLabel('Название группы').fill('Изменённая группа');
    await page.getByLabel('Дни и время занятий').fill('Вторник, 20:00');
    await editorSection(page, 'faq');
    await page
      .getByRole('region', { name: 'Основные ответы' })
      .getByText('Цены', { exact: true })
      .click();
    await page
      .getByRole('region', { name: 'Основные ответы' })
      .getByLabel('Показывать клиентам')
      .first()
      .uncheck();
    await saveEditor(page);
    await editorSection(page, 'core');
    await reviewRevision(page, revision);
    const gate = Promise.withResolvers<void>();
    let writes = 0;
    await page.route('**/api/manage/content/restore', async (route) => {
      writes++;
      const result = await route.fetch();
      if (pendingInput) {
        await gate.promise;
      }
      await route.fulfill({ response: result });
    });
    await page.getByRole('button', { name: 'Да, восстановить' }).click();
    if (pendingInput) {
      await editorView(page, 'edit');
      await page
        .getByLabel('Короткое описание группы')
        .fill('Новая несохранённая правка');
      gate.resolve();
    }
    await expect(
      page.getByText(/Предыдущая версия восстановлена\./).first(),
    ).toBeVisible();
    expect((await readContent(page)).content).toEqual(before.content);
    expect(writes).toBe(1);
    if (pendingInput) {
      await expect(page.getByLabel('Название группы')).toHaveValue(
        'Изменённая группа',
      );
      await expect(page.getByLabel('Короткое описание группы')).toHaveValue(
        'Новая несохранённая правка',
      );
      await expect(
        page.getByText('Есть несохранённые изменения', { exact: true }),
      ).toBeVisible();
      await saveEditor(page);
      expect(
        (await readContent(page)).content.groups!.find(
          (group) => group.id === 'group',
        )!.description,
      ).toBe('Новая несохранённая правка');
    } else {
      await expect(page.getByLabel('Название группы')).toHaveValue(
        'Начинающие',
      );
      await page.reload();
      await openGroup(page);
      await expect(page.getByLabel('Дни и время занятий')).toHaveValue(
        'Понедельник, 19:00',
      );
    }
  });
}

test('old reviewed source survives unrelated save and completes only through valid enrollment', async ({
  page,
}) => {
  const before = await readContent(page);
  await page.getByLabel('Название организации').fill('Другое название');
  await saveEditor(page);
  expect(
    (await readContent(page)).content.groups!.find(
      (group) => group.id === 'review',
    ),
  ).toEqual(before.content.groups!.find((group) => group.id === 'review'));
  await page
    .getByRole('button', { name: 'Старые записи расписания: 1' })
    .click();
  await page.getByRole('button', { name: /^Необычная запись/ }).click();
  await expect(page.locator('pre')).toHaveText(
    'Необычная запись\nСреда, 21:00\nС нуля',
  );
  await page.getByLabel('Открыть набор в группу').click();
  await expect(page.getByRole('alert')).toContainText('Выберите направление');
  await expect(page.getByLabel('Открыть набор в группу')).not.toBeChecked();
  await page.getByLabel('Направление', { exact: true }).selectOption('dance');
  await page.getByLabel('Название группы').fill('Старая группа');
  await page.getByLabel('Дни и время занятий').fill('Среда, 21:00');
  await page.getByLabel('Открыть набор в группу').check();
  await saveEditor(page);
  const completed = (await readContent(page)).content.groups!.find(
    (group) => group.id === 'review',
  )!;
  expect(completed.review).toBeUndefined();
  expect(completed.enrollmentOpen).toBe(true);
  expect(completed.id).toBe('review');
});
