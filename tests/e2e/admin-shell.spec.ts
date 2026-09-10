import { expect, test, type Page } from '@playwright/test';

const password = 'synthetic-admin-password';
const bypassServer = 'http://127.0.0.1:4175';

test('login, history navigation, reload and logout keep the admin boundary', async ({
  page,
}) => {
  await page.goto('/manage');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Вход в управление',
  );

  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ответы клиентам',
  );

  await page.getByRole('link', { name: 'Каналы' }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByRole('link', { name: 'Мониторинг' }).click();
  await expect(page).toHaveURL(/\/ops$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/setup$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/ops$/);

  for (const [path, title] of [
    ['/manage', 'Ответы клиентам'],
    ['/setup', 'Каналы'],
    ['/ops', 'Состояние сервиса'],
  ] as const) {
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }

  await page.goto('/unknown/path');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Страница не найдена',
  );

  await page.goto('/manage');
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const protectedResponse = await page.request.get('/api/manage/content');
  expect(protectedResponse.status()).toBe(401);
});

test('passwordless development bypass skips login and hides logout', async ({
  page,
}) => {
  await page.goto(`${bypassServer}/login`);
  await expect(page).toHaveURL(`${bypassServer}/manage`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ответы клиентам',
  );
  await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(0);
});

for (const viewport of [
  { height: 900, label: 'desktop workspace', width: 1440 },
  { height: 844, label: 'mobile workspace', width: 390 },
]) {
  test(`${viewport.label} keeps its geometry while changing views`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page);

    const workspaceMain = page.locator('.workspace-main');
    const navigation =
      viewport.width >= 900
        ? page.getByRole('navigation', { name: 'Разделы информации' })
        : page.locator('.mobile-workspace-navigation');
    const initialMainBox = await requiredBox(workspaceMain);
    const initialNavigationBox = await requiredBox(navigation);

    if (viewport.width >= 900) {
      await page.getByRole('button', { name: 'Предпросмотр' }).click();
    } else {
      await page.getByLabel('Режим', { exact: true }).selectOption('preview');
    }
    await expect(
      page.getByRole('heading', { name: 'Так клиент увидит ваши ответы' }),
    ).toBeVisible();
    expectStablePlacement(await requiredBox(workspaceMain), initialMainBox);
    expectStableBox(await requiredBox(navigation), initialNavigationBox);

    if (viewport.width >= 900) {
      await page.getByRole('button', { name: 'История' }).click();
    } else {
      await page.getByLabel('Режим', { exact: true }).selectOption('history');
    }
    await expect(
      page.getByRole('heading', { name: 'Предыдущие версии' }),
    ).toBeVisible();
    expectStablePlacement(await requiredBox(workspaceMain), initialMainBox);
    expectStableBox(await requiredBox(navigation), initialNavigationBox);

    if (viewport.width >= 900) {
      await page.getByRole('button', { name: 'Основное' }).click();
    } else {
      await page.getByLabel('Раздел', { exact: true }).selectOption('core');
    }
    await expect(
      page.getByRole('heading', { name: 'Расписание, цены и адрес' }),
    ).toBeVisible();
    expectStablePlacement(await requiredBox(workspaceMain), initialMainBox);
    expectStableBox(await requiredBox(navigation), initialNavigationBox);
  });
}

for (const viewport of [
  { height: 900, label: 'desktop', width: 1440 },
  { height: 800, label: 'small desktop', width: 1024 },
  { height: 844, label: 'mobile', width: 390 },
]) {
  test(`shell stays aligned without horizontal overflow on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page);

    const positions: { left: number; width: number }[] = [];
    for (const path of ['/manage', '/setup', '/ops']) {
      await page.goto(path);
      await expect(page.locator('.admin-topbar')).toBeVisible();
      const box = await page.locator('.admin-topbar').boundingBox();
      expect(box).not.toBeNull();
      positions.push({ left: box?.x ?? 0, width: box?.width ?? 0 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    expect(
      Math.max(...positions.map(({ left }) => left)) -
        Math.min(...positions.map(({ left }) => left)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.max(...positions.map(({ width }) => width)) -
        Math.min(...positions.map(({ width }) => width)),
    ).toBeLessThanOrEqual(1);

    await page.getByRole('link', { name: 'Ответы' }).focus();
    const outline = await page
      .getByRole('link', { name: 'Ответы' })
      .evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
  });
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  if (page.url().endsWith('/login')) {
    await page.getByLabel('Пароль').fill(password);
    await page.getByRole('button', { name: 'Войти' }).click();
  }
  await expect(page).toHaveURL(/\/manage$/);
}

async function requiredBox(locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) {
    throw new Error('Expected the element to have a bounding box');
  }
  return box;
}

function expectStableBox(
  actual: Awaited<ReturnType<typeof requiredBox>>,
  expected: Awaited<ReturnType<typeof requiredBox>>,
): void {
  expectStablePlacement(actual, expected);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(1);
}

function expectStablePlacement(
  actual: Awaited<ReturnType<typeof requiredBox>>,
  expected: Awaited<ReturnType<typeof requiredBox>>,
): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(1);
}
