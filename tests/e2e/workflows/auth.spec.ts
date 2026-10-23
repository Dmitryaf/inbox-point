import { expect, test } from '@playwright/test';

import { login, password } from './support/auth.js';

// Revoke-all changes the shared synthetic auth store, so these tests run in order.
test.describe.configure({ mode: 'default' });

for (const width of [390, 1280]) {
  test(`login, shell navigation, reload and logout preserve access at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/manage/content', (route) =>
      route.fulfill({
        json: {
          content: {
            schedule: '',
            scheduleItems: [],
            organizationName:
              'Учебная организация с длинным названием для проверки переноса текста в шапке',
          },
          version: 'a'.repeat(64),
        },
      }),
    );
    await page.goto('/ops');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Пароль', { exact: true }).fill('wrong');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Неверный пароль.');
    await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('');
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Запомнить это устройство на 30 дней').check();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/ops$/);
    const cookie = (await page.context().cookies()).find(
      (item) => item.name === 'inbox-point-admin-session',
    );
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000);
    await page.getByRole('link', { name: 'Каналы', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByRole('link', { name: 'Каналы', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: 'Аналитика', exact: true }).click();
    await page.goBack();
    await expect(page).toHaveURL(/\/setup$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/analytics$/);
    for (const [path, title] of [
      ['/manage', 'Ответы клиентам'],
      ['/setup', 'Каналы'],
      ['/analytics', 'Аналитика'],
      ['/ops', 'Состояние сервиса'],
    ] as const) {
      await page.goto(path);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(page).toHaveTitle(`${title} — Inbox Point`);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`react-shell-${width}.png`),
      fullPage: true,
    });
    await page.unroute('**/api/manage/content');
    await page.getByRole('button', { name: 'Выйти', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/manage/content')).status()).toBe(401);
  });
}

test('bypass skips login and hides logout', async ({ page }) => {
  await page.goto('http://127.0.0.1:4189/login');
  await expect(page).toHaveURL('http://127.0.0.1:4189/manage');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ответы клиентам',
  );
  await expect(
    page.getByRole('button', { name: 'Выйти', exact: true }),
  ).toHaveCount(0);
});

test('unknown paths show the standalone not-found page', async ({ page }) => {
  await page.goto('/unknown/path');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Страница не найдена',
  );
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Открыть ответы' }),
  ).toHaveAttribute('href', '/manage');
});

test('logout failure keeps access and permits retry', async ({ page }) => {
  await login(page, '/setup');
  await page.route('**/api/admin/logout', (route) =>
    route.fulfill({
      status: 503,
      json: { message: 'Не удалось выйти. Попробуйте ещё раз.' },
    }),
  );
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось выйти.');
  await expect(page).toHaveURL(/\/setup$/);
  expect((await page.request.get('/api/manage/content')).status()).toBe(200);
  await page.unroute('**/api/admin/logout');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/manage/content')).status()).toBe(401);
});

test('protected 401 expires the session without a login loop', async ({
  page,
}) => {
  await page.route('**/api/manage/content', (route) =>
    route.fulfill({
      status: 401,
      json: { message: 'Войдите, чтобы продолжить.' },
    }),
  );
  await page.goto('/setup');
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('alert')).toContainText('Сессия завершилась.');
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('revoke all requires confirmation and revokes a second browser session', async ({
  page,
  browser,
}) => {
  await login(page, '/setup');
  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    await login(otherPage, 'http://127.0.0.1:4188/manage');
    page.once('dialog', (dialog) => dialog.dismiss());
    await page
      .getByRole('button', { name: 'Выйти на всех устройствах' })
      .click();
    expect(
      (
        await otherPage.request.get('http://127.0.0.1:4188/api/manage/content')
      ).status(),
    ).toBe(200);
    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: 'Выйти на всех устройствах' })
      .click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (
        await otherPage.request.get('http://127.0.0.1:4188/api/manage/content')
      ).status(),
    ).toBe(401);
    await otherPage.reload();
    await expect(otherPage).toHaveURL(/\/login$/);
  } finally {
    await otherContext.close();
  }
});
