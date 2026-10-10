import { expect, test, type Page } from '@playwright/test';

const password = 'synthetic-admin-password';
const bypassServer = 'http://127.0.0.1:4175';

for (const width of [1440, 390]) {
  test(`custom application purpose survives save and reload at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let content = {
      schedule: '',
      scheduleItems: [] as unknown[],
      customSections: [] as unknown[],
    };
    let version = 'a'.repeat(64);
    await page.route('**/api/manage/content', async (route) => {
      if (route.request().method() === 'POST') {
        const submitted = route.request().postDataJSON() as {
          content: typeof content;
        };
        content = submitted.content;
        version = 'b'.repeat(64);
      }
      await route.fulfill({ json: { content, version } });
    });
    await login(page);
    const openCustom = async () => {
      if (width >= 900) {
        await page
          .getByRole('button', { name: 'Дополнительные кнопки' })
          .click();
      } else {
        await page.getByLabel('Раздел', { exact: true }).selectOption('custom');
      }
    };
    await openCustom();
    await page.getByRole('button', { name: 'Добавить раздел' }).click();
    await page.getByLabel('Название кнопки').fill('Записаться на занятие');
    await page.getByRole('radio', { name: /Принять заявку/ }).focus();
    await page.keyboard.press('Space');
    await page
      .getByLabel('Что спросить у клиента?')
      .fill('На какое занятие и в какой день хотите записаться?');
    await expect(
      page.getByRole('radio', { name: /Принять заявку/ }),
    ).toBeChecked();
    await expect(
      page.getByText(
        'Бот спросит нужные детали и передаст ответ администратору.',
        { exact: false },
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('application-editor.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Все изменения сохранены')).toBeVisible();
    expect(content.customSections).toEqual([
      expect.objectContaining({
        mode: 'application',
        label: 'Записаться на занятие',
      }),
    ]);
    await page.reload();
    await openCustom();
    await expect(
      page.getByRole('radio', { name: /Принять заявку/ }),
    ).toBeChecked();
    await expect(page.getByLabel('Что спросить у клиента?')).toHaveValue(
      'На какое занятие и в какой день хотите записаться?',
    );
    if (width >= 900) {
      await page.getByRole('button', { name: 'Предпросмотр' }).click();
    } else {
      await page.getByLabel('Режим', { exact: true }).selectOption('preview');
    }
    await expect(page.locator('.preview-response')).toContainText(
      'Он придёт администратору как заявка «Записаться на занятие»',
    );
    await expect(page.locator('.preview-response')).toContainText(
      'Заявка отправлена. Администратор ответит здесь.',
    );
    await page.screenshot({
      path: testInfo.outputPath('application-preview.png'),
      fullPage: true,
    });
  });
}

test('remembered login, navigation, reload and logout keep the admin boundary', async ({
  page,
}) => {
  await page.goto('/manage');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Вход в управление',
  );
  await expect(page.locator('.product-logo__mark')).toBeVisible();

  await page.getByLabel('Пароль').fill(password);
  await page.getByLabel('Запомнить это устройство на 30 дней').check();
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/manage$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ответы клиентам',
  );
  await expect(
    page.getByRole('link', { name: 'Inbox Point — открыть ответы' }),
  ).toBeVisible();

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
  await page.getByRole('button', { exact: true, name: 'Выйти' }).click();
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
  await expect(
    page.getByRole('button', { exact: true, name: 'Выйти' }),
  ).toHaveCount(0);
});

test('a review record is completed in the group editor, saved and reopened without losing its source data', async ({
  page,
}) => {
  let content = {
    schedule: '',
    scheduleItems: [],
    directions: [{ id: 'dance', name: 'Танец' }],
    groups: [
      {
        id: 'review',
        directionId: '',
        name: '',
        meetings: [] as string[],
        description: '',
        enrollmentOpen: false,
        applicationQuestion: '',
        review: {
          source: 'Вечерняя группа\nПн / Ср, 20:00\nДля учеников с опытом.',
        },
      },
    ],
    keywords: [],
  };
  let version = 'a'.repeat(64);
  await page.route('**/api/manage/content', async (route) => {
    if (route.request().method() === 'POST') {
      content = (route.request().postDataJSON() as { content: typeof content })
        .content;
      version = 'b'.repeat(64);
    }
    await route.fulfill({ json: { content, version } });
  });
  await login(page);
  await page.getByRole('button', { name: 'Нужно проверить: 1' }).click();
  await page.locator('.class-list-item').click();
  await expect(page.locator('.class-review pre')).toHaveText(
    content.groups[0]!.review.source,
  );
  await expect(page.getByLabel('Открыть набор в группу')).toBeDisabled();
  await page.locator('#review-direction-review').selectOption('dance');
  await page
    .getByLabel('Название группы', { exact: true })
    .fill('Вечерняя группа');
  await page.getByRole('button', { name: 'Добавить день и время' }).click();
  await page
    .getByLabel('День и время 1', { exact: true })
    .fill('Пн / Ср, 20:00');
  await page.getByText('Дополнительные настройки', { exact: true }).click();
  await page
    .getByLabel('Короткое описание группы')
    .fill('Для учеников с опытом.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Подтвердить данные' }).click();
  await expect(page.locator('.class-review')).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Все изменения сохранены')).toBeVisible();
  await page.reload();
  await page.locator('.class-list-item').click();
  await page.locator('.class-list-item').click();
  await expect(page.getByLabel('Название группы', { exact: true })).toHaveValue(
    'Вечерняя группа',
  );
  await expect(page.getByLabel('День и время 1', { exact: true })).toHaveValue(
    'Пн / Ср, 20:00',
  );
  await expect(page.getByLabel('Открыть набор в группу')).not.toBeChecked();
  await page.getByText('Что увидит клиент', { exact: true }).click();
  await expect(page.locator('.class-preview pre')).toContainText(
    'Для учеников с опытом.',
  );
});

test('message controls distinguish disconnected channels from active intake', async ({
  page,
}) => {
  await login(page);
  await page.goto('/ops');
  const connectionGuide = page.locator('.connection-guide');
  await expect(
    page.getByRole('heading', { name: 'Закончите подключение' }),
  ).toBeVisible();
  await expect(connectionGuide.locator('li')).toHaveCount(2);
  await expect(
    connectionGuide.getByRole('link', { name: 'Начать подключение' }),
  ).toHaveAttribute('href', '/setup');
  await page.getByText('Открыть управление').click();

  const controls = page.locator('.intake-channel-list');
  await expect(controls.getByText('Не подключён', { exact: true })).toHaveCount(
    2,
  );
  await expect(
    controls.getByRole('button', { name: 'Приостановить' }),
  ).toHaveCount(0);
  await expect(controls).toContainText(
    'Подключите Telegram в разделе «Каналы».',
  );
});

for (const viewport of [
  { height: 900, label: 'desktop', width: 1440 },
  { height: 844, label: 'mobile', width: 390 },
]) {
  test(`Telegram setup gives a concrete first-time checklist on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page);
    await page.goto('/setup');
    await page.getByRole('button', { name: 'Подключить Telegram' }).click();

    await expect(page.getByText('Что вы настраиваете')).toBeVisible();
    await expect(page.locator('.setup-steps > li')).toHaveCount(6);
    await expect(
      page.getByRole('link', { name: '«Открыть @BotFather»' }),
    ).toHaveAttribute('href', 'https://t.me/BotFather');
    await expect(
      page.getByLabel('Токен бота — строка-пароль от @BotFather'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Проверить токен и найти группу' }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test('VK setup stays anchored while details open', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await login(page);
  await page.route('**/api/setup/status', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        connected: true,
        locked: true,
        source: 'local',
        vk: { connected: false, locked: false, source: 'none' },
      },
    });
  });
  await page.goto('/setup');

  const vkCard = page.locator('.setup-card').filter({ hasText: 'VK' });
  const collapsed = await requiredBox(vkCard);
  await vkCard.getByRole('button', { name: 'Подключить VK' }).click();
  await expect(
    page.getByText('Включите входящие и исходящие сообщения в Long Poll API.'),
  ).toBeVisible();
  const expanded = await requiredBox(vkCard);

  expectStablePlacement(expanded, collapsed);
  await expect(vkCard).toContainText(
    '«Дополнительно» → «Работа с API» → «Long Poll API»',
  );
  await expect(vkCard).toContainText('«Исходящие сообщения»');
  await expect(vkCard).toContainText('обязательно поставьте две галочки');
  await expect(vkCard).toContainText('Добавить кнопку „Начать“');
  await expect(vkCard).toContainText(
    'Разрешить приложению доступ к управлению сообществом',
  );
});

for (const viewport of [
  { height: 900, label: 'desktop', width: 1440 },
  { height: 844, label: 'mobile', width: 390 },
]) {
  test(`empty editor blocks keep visible spacing on ${viewport.label}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await login(page);

    if (viewport.width >= 900) {
      await page.getByRole('button', { name: 'Дополнительные кнопки' }).click();
    } else {
      await page.getByLabel('Раздел', { exact: true }).selectOption('custom');
    }

    expect(
      await requiredVerticalGap(
        page.getByRole('heading', { name: 'Дополнительные разделы' }),
        page.getByText('Дополнительных разделов пока нет.'),
      ),
    ).toBeGreaterThanOrEqual(12);
  });
}

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
      page.getByRole('heading', { name: 'Предпросмотр ответов' }),
    ).toBeVisible();
    await expectTelegramKeyboardLayout(page);
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
    expect(
      await requiredVerticalGap(
        page.getByRole('heading', { name: 'Предыдущие версии' }),
        page.getByText('Изменений пока нет.'),
      ),
    ).toBeGreaterThanOrEqual(12);
    expectStablePlacement(await requiredBox(workspaceMain), initialMainBox);
    expectStableBox(await requiredBox(navigation), initialNavigationBox);

    if (viewport.width >= 900) {
      await page.getByRole('button', { name: 'Занятия' }).click();
    } else {
      await page.getByLabel('Раздел', { exact: true }).selectOption('core');
    }
    await expect(
      page.getByRole('region', { name: 'Занятия', exact: true }),
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

    await page.getByRole('link', { name: 'Ответы', exact: true }).focus();
    const outline = await page
      .getByRole('link', { name: 'Ответы', exact: true })
      .evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
  });
}

test('opening channel details does not resize the other channel card', async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await login(page);
  await page.route('**/api/ops/status', async (route) => {
    const channel = {
      configured: true,
      lastSuccessfulPollAt: '2026-09-14T16:14:21.000Z',
      running: true,
      source: 'local',
      state: 'running',
    };
    await route.fulfill({
      contentType: 'application/json',
      json: {
        channels: { telegram: channel, vk: channel },
        deliveries: {
          failed: 0,
          incidents: [],
          pending: 0,
          state: 'healthy',
          uncertain: 0,
          worker: { running: true, state: 'running' },
        },
        inboundEvents: { incidents: [], quarantined: 0, state: 'healthy' },
        intake: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
        observedAt: '2026-09-14T16:15:00.000Z',
        operatorInbox: {
          recoverableWebRequests: 0,
          state: 'healthy',
          webOwnedRequests: 0,
        },
        operatorRelays: { incidents: [], state: 'healthy', uncertain: 0 },
        outbound: { mode: 'active' },
        startedAt: '2026-09-14T12:15:00.000Z',
        state: 'healthy',
        uptimeSeconds: 14_400,
      },
    });
  });
  await page.goto('/ops');

  const telegramCard = page.locator('.status-card').filter({
    has: page.getByRole('heading', { name: 'Telegram' }),
  });
  const vkCard = page.locator('.status-card').filter({
    has: page.getByRole('heading', { name: 'VK', exact: true }),
  });
  const telegramCollapsed = await requiredBox(telegramCard);
  const vkCollapsed = await requiredBox(vkCard);

  await vkCard.locator('summary').click();
  await expect(vkCard.locator('details')).toHaveAttribute('open', '');

  const telegramAfter = await requiredBox(telegramCard);
  const vkExpanded = await requiredBox(vkCard);
  expectStableBox(telegramAfter, telegramCollapsed);
  expect(vkExpanded.height).toBeGreaterThan(vkCollapsed.height);
});

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

async function requiredVerticalGap(
  before: ReturnType<Page['locator']>,
  after: ReturnType<Page['locator']>,
): Promise<number> {
  await expect(before).toBeVisible();
  await expect(after).toBeVisible();
  const afterElement = await after.elementHandle();
  if (!afterElement) {
    throw new Error('Expected the following element to exist');
  }
  try {
    // Read both rectangles in one frame while their parent may be moving.
    return await before.evaluate(
      (element, following) =>
        following.getBoundingClientRect().top -
        element.getBoundingClientRect().bottom,
      afterElement,
    );
  } finally {
    await afterElement.dispose();
  }
}

async function expectTelegramKeyboardLayout(page: Page): Promise<void> {
  const rows = page.locator('.message-preview-button-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('span')).toHaveText(['Расписание', 'Цены']);
  await expect(rows.nth(1).locator('span')).toHaveText([
    'Адрес',
    'Частые вопросы',
  ]);
  await expect(rows.nth(2).locator('span')).toHaveText(['Задать вопрос']);

  const firstRow = await requiredBox(rows.nth(0));
  const actionRow = await requiredBox(rows.nth(2));
  expect(Math.abs(firstRow.width - actionRow.width)).toBeLessThanOrEqual(1);

  const firstButton = await requiredBox(rows.nth(0).locator('span').nth(0));
  const secondButton = await requiredBox(rows.nth(0).locator('span').nth(1));
  expect(Math.abs(firstButton.y - secondButton.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(firstButton.width - secondButton.width)).toBeLessThanOrEqual(
    1,
  );
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
