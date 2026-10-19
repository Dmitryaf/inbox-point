import { editorSection, editorView } from './support/navigation.js';
import { expect, test } from '@playwright/test';
import type {
  ClientInformationContent,
  ScheduleItem,
} from '@/core/application/client-information.js';
import { login, password } from './support/auth.js';

const base = 'http://127.0.0.1:4190';
interface ContentSnapshot {
  content: Omit<ClientInformationContent, 'schedule'> & {
    schedule: string;
    scheduleItems: ScheduleItem[];
  };
  version: string;
}
test.describe.configure({ mode: 'default' });
test.beforeEach(async ({ page }, testInfo) => {
  await login(page, `${base}/manage`);
  const snapshot = (await (
    await page.request.get(`${base}/api/manage/content`)
  ).json()) as ContentSnapshot;
  const seeded = await page.request.post(`${base}/api/manage/content`, {
    headers: { origin: base },
    data: {
      ...snapshot,
      content: {
        ...snapshot.content,
        organizationName: `Учебная организация ${testInfo.testId.slice(-10)}`,
      },
    },
  });
  expect(seeded.status()).toBe(200);
  await page.reload();
  await expect(page.getByLabel('Название организации')).toBeVisible();
  await editorSection(page, 'faq');
});

for (const width of [390, 1280]) {
  test(`information writes and reopens through the actual content store at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const before = (await (
      await page.request.get(`${base}/api/manage/content`)
    ).json()) as ContentSnapshot;
    await page
      .getByLabel('Название организации')
      .fill(
        'Учебная организация с длинным названием для проверки переноса текста в шапке',
      );
    await page
      .getByRole('region', { name: 'Основные ответы' })
      .getByText('Цены', { exact: true })
      .click();
    await page
      .locator('#prices')
      .fill(`Абонемент ${width} — 5000 ₽\nПробное занятие — бесплатно.`);
    await page
      .getByRole('region', { name: 'Основные ответы' })
      .getByText('Адрес', { exact: true })
      .click();
    await page.locator('#address').fill('ул. Примерная, 20, вход со двора');
    await page
      .locator('#faq-answer-0')
      .fill('Напишите администратору в мессенджере.');
    const posted = page.waitForResponse(
      (res) =>
        res.url().endsWith('/api/manage/content') &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await posted).status()).toBe(200);
    await expect(
      page.getByText('Все изменения сохранены', { exact: true }),
    ).toBeVisible();
    const after = (await (
      await page.request.get(`${base}/api/manage/content`)
    ).json()) as ContentSnapshot;
    for (const key of [
      'directions',
      'groups',
      'keywords',
      'customSections',
      'schedule',
      'scheduleItems',
      'visibleSections',
    ] as const) {
      expect(after.content[key]).toEqual(before.content[key]);
    }
    await page.reload();
    await editorSection(page, 'faq');
    await page
      .getByRole('region', { name: 'Основные ответы' })
      .getByText('Цены', { exact: true })
      .click();
    await expect(page.locator('#prices')).toHaveValue(
      `Абонемент ${width} — 5000 ₽\nПробное занятие — бесплатно.`,
    );
    await expect(page.locator('#faq-answer-0')).toHaveValue(
      'Напишите администратору в мессенджере.',
    );
    if (width < 900) {
      await page.getByLabel('Режим', { exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Раздел', { exact: true })).toBeFocused();
    } else {
      await page.getByRole('button', { name: 'Занятия', exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', { name: 'Информация', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('button', {
          name: 'Дополнительные кнопки',
          exact: true,
        }),
      ).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Название организации')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      page
        .getByRole('region', { name: 'Основные ответы' })
        .getByText('Цены', { exact: true })
        .locator('..'),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`react-information-${width}.png`),
      fullPage: true,
    });
  });
}

test('pending save keeps later input dirty and failed save permits a real retry', async ({
  page,
}) => {
  const pending = Promise.withResolvers<void>();
  let attempts = 0;
  await page.route('**/api/manage/content', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    attempts++;
    if (attempts === 1) {
      await pending.promise;
      await route.continue();
    } else {
      await route.fulfill({
        status: 503,
        json: { message: 'Не удалось сохранить информацию.' },
      });
    }
  });
  await page.getByLabel('Название организации').fill('Первая отправка');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByLabel('Название организации').fill('Последующий ввод');
  await expect(
    page.getByRole('button', { name: 'Сохранить', exact: true }),
  ).toBeDisabled();
  pending.resolve();
  await expect(
    page.getByText('Есть несохранённые изменения', { exact: true }),
  ).toBeVisible();
  const saved = (await (
    await page.request.get(`${base}/api/manage/content`)
  ).json()) as ContentSnapshot;
  expect(saved.content.organizationName).toBe('Первая отправка');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Ваши изменения остались на этой странице.',
  );
  await expect(page.getByLabel('Название организации')).toHaveValue(
    'Последующий ввод',
  );
  expect(attempts).toBe(2);
  await page.unroute('**/api/manage/content');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    page.getByText('Все изменения сохранены', { exact: true }),
  ).toBeVisible();
});

for (const action of ['save', 'preview']) {
  test(`real expired session recovers draft after ${action} and login`, async ({
    page,
  }) => {
    const before = (await (
      await page.request.get(`${base}/api/manage/content`)
    ).json()) as ContentSnapshot;
    await page
      .getByLabel('Название организации')
      .fill('Несохранённый черновик');
    await page.request.post(`${base}/api/admin/logout`, {
      headers: { origin: base },
      data: {},
    });
    if (action === 'save') {
      await page
        .getByRole('button', { name: 'Сохранить', exact: true })
        .click();
    } else {
      await editorView(page, 'history');
      await page
        .getByRole('button', { name: 'Посмотреть версию' })
        .first()
        .click();
    }
    await expect(page).toHaveURL(`${base}/login`);
    await page.reload();
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByLabel('Название организации')).toHaveValue(
      'Несохранённый черновик',
    );
    await expect(
      page.getByText('Несохранённый черновик восстановлен.'),
    ).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('inbox-point:content-draft'),
      ),
    ).toBeNull();
    const request = page.waitForRequest(
      (req) =>
        req.url().endsWith('/api/manage/content') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect((await request).postDataJSON()).toMatchObject({
      version: before.version,
    });
    await expect(
      page.getByText('Все изменения сохранены', { exact: true }),
    ).toBeVisible();
  });
}

test('dirty link, Back and logout confirmations keep edits on cancel', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Каналы', exact: true }).click();
  await page.getByRole('link', { name: 'Ответы', exact: true }).click();
  await page.getByLabel('Название организации').fill('Защищённый черновик');
  const beforeUnload = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const dialog = await beforeUnload;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  expect(page.isClosed()).toBe(false);
  await expect(page.getByLabel('Название организации')).toHaveValue(
    'Защищённый черновик',
  );
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Каналы', exact: true }).click();
  await expect(page).toHaveURL(`${base}/manage`);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(`${base}/manage`);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByLabel('Название организации')).toHaveValue(
    'Защищённый черновик',
  );
  expect((await page.request.get(`${base}/api/manage/content`)).status()).toBe(
    200,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('link', { name: 'Каналы', exact: true }).click();
  await expect(page).toHaveURL(`${base}/setup`);
});

test('a real version conflict retains the draft and does not overwrite another writer', async ({
  page,
}) => {
  const before = (await (
    await page.request.get(`${base}/api/manage/content`)
  ).json()) as ContentSnapshot;
  await page.getByLabel('Название организации').fill('Мой несохранённый текст');
  const external = await page.request.post(`${base}/api/manage/content`, {
    headers: { origin: base },
    data: {
      ...before,
      content: {
        ...before.content,
        organizationName: 'Изменение в другой вкладке',
      },
    },
  });
  expect(external.status()).toBe(200);
  const conflict = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/manage/content') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText(
    'уже изменилась в другой вкладке',
  );
  await expect(page.getByLabel('Название организации')).toHaveValue(
    'Мой несохранённый текст',
  );
  await expect(
    page.getByText('Есть несохранённые изменения', { exact: true }),
  ).toBeVisible();
  const stored = (await (
    await page.request.get(`${base}/api/manage/content`)
  ).json()) as ContentSnapshot;
  expect(stored.content.organizationName).toBe('Изменение в другой вкладке');
});
