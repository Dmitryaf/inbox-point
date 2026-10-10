import { expect, test } from '@playwright/test';
import {
  documentTop,
  enlargeText,
  noHorizontalOverflow,
} from './support/design-checks.js';
import {
  attentionOperations,
  designRequests,
  designMessages,
  emergencyOperations,
} from './support/design-fixtures.js';

// Review these synthetic captures manually for hierarchy, wrapping and overlap.
// Passing the geometry assertions does not establish visual quality or usability.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === 'passed') {
    await page.screenshot({
      path: testInfo.outputPath('design-state.png'),
      fullPage: true,
      animations: 'disabled',
    });
  }
});

for (const width of [390, 1280]) {
  test(`editor and setup handle keyboard input and enlarged long text at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:4175/setup');
    const toggle = page.locator('[aria-controls="telegram-setup-details"]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#telegram-setup-details')).toBeVisible();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveCSS('outline-width', '3px');
    await toggle.press('Enter');
    await expect(page.locator('#telegram-setup-details')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Сначала Telegram' }),
    ).toBeDisabled();
    await expect(page.locator('.status-pill').first()).toHaveCSS(
      'font-weight',
      '600',
    );

    await page.getByRole('link', { name: 'Ответы', exact: true }).click();
    const save = page.getByRole('button', { name: 'Сохранить', exact: true });
    await expect(save).toBeDisabled();
    if (width === 390) {
      const firstActionTop = await page
        .locator('.class-list-item')
        .first()
        .evaluate((el) => el.getBoundingClientRect().top + scrollY);
      expect(firstActionTop).toBeLessThan(550);
    }
    await page.locator('.class-list-item').first().click();
    await page.locator('.class-list-item').first().click();
    await expect(
      page.getByLabel('Название группы', { exact: true }),
    ).toBeVisible();

    // Models enlarged system text; does not claim browser zoom coverage.
    await page.route('**/test-enlarged-text.css', (route) =>
      route.fulfill({
        body: ':root { font-size: 125%; }',
        contentType: 'text/css',
      }),
    );
    await page.addStyleTag({ url: '/test-enlarged-text.css' });
    const title =
      'Бачата для начинающих — вечерняя группа с дополнительной практикой';
    await page.getByLabel('Название группы', { exact: true }).fill(title);
    await page.getByLabel('Название группы', { exact: true }).press('Tab');
    await expect(
      page.getByLabel('День и время 1', { exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel('День и время 1', { exact: true })).toHaveCSS(
      'outline-width',
      '3px',
    );
    await page.getByText('Дополнительные настройки', { exact: true }).click();
    await page
      .getByLabel('Короткое описание группы')
      .fill(
        'Подходит тем, кто начинает с нуля. Возьмите сменную обувь и воду. '.repeat(
          8,
        ),
      );
    if (width >= 1100) {
      await expect(page.locator('.workspace-live-preview')).toBeVisible();
      await page.getByText('Что увидит клиент', { exact: true }).click();
      await expect(page.locator('.class-preview pre')).toContainText(title);
    } else {
      await expect(page.locator('.workspace-live-preview')).toBeHidden();
      await page.getByLabel('Режим', { exact: true }).selectOption('preview');
      await expect(page.locator('.preview')).toContainText('Бачата');
      await page.getByLabel('Режим', { exact: true }).selectOption('edit');
      await expect(
        page.getByLabel('Название группы', { exact: true }),
      ).toHaveValue(title);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(save).toBeEnabled();
  });
}

for (const width of [390, 1280]) {
  test(`editor loading and failure recover without pretending content is empty at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    let first = true;
    await page.route('**/api/manage/content', async (route) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await route.fulfill({ status: 503, json: {} });
      } else {
        await route.fulfill({
          json: {
            content: {
              schedule: '',
              prices: '',
              address: '',
              faq: [],
              scheduleItems: [],
              customSections: [],
            },
            version: 'a'.repeat(64),
          },
        });
      }
    });
    await page.goto('http://127.0.0.1:4175/manage');
    await expect(page.getByRole('status')).toContainText(
      'Загружаем информацию',
    );
    release();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByText('Редактор не открыт. Повторите загрузку.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Сохранить', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Повторить', exact: true })
      .press('Enter');
    await expect(page.locator('.content-summary')).toContainText(
      'Пока не заполнено',
    );
    await enlargeText(page);
    await expect(
      page.getByRole('button', { name: 'Добавить направление' }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test(`monitoring loading and failure retain unknown state until retry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    let first = true;
    await page.route('**/api/ops/status', async (route) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await route.fulfill({ status: 503, json: {} });
      } else {
        await route.fulfill({ json: attentionOperations });
      }
    });
    await page.goto('http://127.0.0.1:4175/ops');
    await expect(page.getByRole('status')).toContainText(
      'Проверяем работу каналов',
    );
    release();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByText('Состояние каналов неизвестно. Повторите проверку.'),
    ).toBeVisible();
    await expect(page.getByText('Проверяем работу каналов…')).toHaveCount(0);
    await enlargeText(page);
    await noHorizontalOverflow(page);
    await page
      .getByRole('button', { name: 'Повторить проверку', exact: true })
      .press('Enter');
    await expect(
      page.getByRole('button', { name: 'Повторить отправку' }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
  });

  test(`analytics leads with menu usage and keeps independent counts at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:4175/analytics');
    await enlargeText(page);
    const menu = page.getByRole('heading', { name: 'Что выбирают в меню' });
    const chart = page.getByRole('heading', { name: 'Активность по дням' });
    await expect(menu).toBeVisible();
    expect(await documentTop(menu)).toBeLessThan(await documentTop(chart));
    await expect(
      page.getByRole('rowheader', {
        name: 'Записаться на первое пробное занятие',
      }),
    ).toBeVisible();
    await expect(page.locator('.usage-channels')).toContainText('Обращения: 8');
    await expect(page.locator('.question-context')).toContainText(
      'Кнопки для вопросов',
    );
    await expect(page.locator('.question-path dd')).toHaveText('13');
    const numericWidths = await page
      .locator('.menu-usage thead th')
      .evaluateAll((headers) =>
        headers.slice(1).map((header) => header.getBoundingClientRect().width),
      );
    expect(
      Math.max(...numericWidths) - Math.min(...numericWidths),
    ).toBeLessThanOrEqual(1);
    const context = page.locator('.question-context');
    if (width === 390) {
      expect(await documentTop(context)).toBeGreaterThan(
        await documentTop(page.locator('.menu-usage')),
      );
    } else {
      const menuBox = await page.locator('.menu-usage').boundingBox();
      const contextBox = await context.boundingBox();
      expect(contextBox!.x).toBeGreaterThan(menuBox!.x + menuBox!.width);
    }
    const days = page.locator('.daily-toggle');
    if (width > 600) {
      await days.press('Enter');
      await expect(days).toBeFocused();
      await expect(days).toHaveAttribute('aria-expanded', 'true');
      await expect(days).toHaveCSS('outline-width', '3px');
    } else {
      await expect(days).toBeHidden();
      await expect(page.locator('.activity-chart')).toBeHidden();
      const values = page.locator('.daily-values');
      await values.focus();
      await expect(values).toHaveCSS('outline-width', '3px');
      await values.press('End');
      await expect
        .poll(() => values.evaluate((el) => el.scrollTop))
        .toBeGreaterThan(0);
    }
    await expect(page.locator('.daily-values tbody tr')).toHaveCount(30);
    await noHorizontalOverflow(page);
  });

  test(`channel checks recover and disclose the next connection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let release!: () => void;
    let first = true;
    await page.route('**/api/setup/status', async (route) => {
      if (first) {
        first = false;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        await route.fulfill({ status: 503, json: {} });
      } else {
        await route.fulfill({
          json: {
            connected: true,
            locked: true,
            source: 'environment',
            vk: { connected: false, locked: false, source: 'none' },
          },
        });
      }
    });
    await page.goto('http://127.0.0.1:4175/setup');
    await expect(page.getByRole('status')).toContainText(
      'Проверяем подключения',
    );
    release();
    await expect(page.getByRole('alert')).toBeVisible();
    await page
      .getByRole('button', { name: 'Повторить проверку подключений' })
      .press('Enter');
    await expect(
      page.locator('[aria-labelledby="telegram-setup-title"]'),
    ).toContainText('Подключён');
    await enlargeText(page);
    const vkToggle = page.locator('[aria-controls="vk-setup-details"]');
    await expect(vkToggle).toBeEnabled();
    await vkToggle.press('Enter');
    await expect(vkToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(vkToggle).toBeFocused();
    await expect(vkToggle).toHaveCSS('outline-width', '3px');
    await expect(
      page.getByLabel('Ссылка на страницу сообщества VK'),
    ).toBeVisible();
    await expect(
      page.locator('#vk-setup-details button[type="submit"]'),
    ).toBeDisabled();
    await expect(
      page.locator('[aria-labelledby="vk-setup-title"]'),
    ).toContainText('ту же группу Telegram');
    await noHorizontalOverflow(page);
  });

  test(`monitoring puts actionable incidents before overview and diagnostics at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const status = structuredClone(attentionOperations);
    status.deliveries.incidents[0]!.messageText =
      'Приходите на первое занятие в понедельник к 19:00. Возьмите сменную обувь и воду. '.repeat(
        8,
      );
    await page.route('**/api/ops/status', (route) =>
      route.fulfill({ json: status }),
    );
    await page.goto('http://127.0.0.1:4175/ops');
    const retry = page.getByRole('button', { name: 'Повторить отправку' });
    await expect(retry).toBeVisible();
    await enlargeText(page);
    expect(await documentTop(retry)).toBeLessThan(
      await documentTop(page.locator('.service-summary')),
    );
    expect(await documentTop(page.locator('.service-summary'))).toBeLessThan(
      await documentTop(page.locator('.status-grid')),
    );
    expect(await documentTop(page.locator('.status-grid'))).toBeLessThan(
      await documentTop(page.locator('.message-flow-control')),
    );
    const details = page.locator('.delivery-incidents summary');
    await details.press('Enter');
    await expect(
      page.getByText('synthetic-request', { exact: true }),
    ).toBeVisible();
    await details.press('Enter');
    await expect(
      page.getByText('synthetic-request', { exact: true }),
    ).toBeHidden();
    await retry.press('Tab');
    await page.locator('.message-flow-summary').press('Enter');
    await expect(page.locator('.message-flow-control')).toHaveAttribute(
      'open',
      '',
    );
    await expect(page.locator('.message-flow-summary')).toHaveCSS(
      'outline-width',
      '3px',
    );
    await noHorizontalOverflow(page);
  });

  test(`emergency inbox keeps long selections readable and conversation usable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/ops/status', (route) =>
      route.fulfill({ json: emergencyOperations }),
    );
    await page.route('**/api/ops/inbox/requests', (route) =>
      route.fulfill({ json: { requests: designRequests } }),
    );
    let failSecond = true;
    await page.route('**/api/ops/inbox/requests/*/messages', (route) => {
      const id = route.request().url().split('/').at(-2)!;
      if (id === 'synthetic-request-1' && failSecond) {
        failSecond = false;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({
        json: {
          messages: id === 'synthetic-request-2' ? [] : designMessages(id),
        },
      });
    });
    await page.goto('http://127.0.0.1:4175/ops');
    const selected = page.locator('.operator-request-button').first();
    await expect(selected).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.operator-message-list li')).toHaveCount(24);
    await enlargeText(page);
    const fits = await selected.evaluate(
      (element) => element.scrollHeight <= element.clientHeight + 1,
    );
    expect(fits).toBe(true);
    const list = page.locator('.operator-request-list');
    const conversation = page.getByRole('article', {
      name: 'Выбранное обращение',
    });
    const listBox = await list.boundingBox();
    const conversationBox = await conversation.boundingBox();
    const headingBox = await page
      .locator('.operator-conversation-heading')
      .boundingBox();
    const messagesBox = await page
      .locator('.operator-message-list')
      .boundingBox();
    const replyBox = await page.locator('.operator-reply-form').boundingBox();
    expect(messagesBox!.y).toBeGreaterThanOrEqual(
      headingBox!.y + headingBox!.height,
    );
    expect(replyBox!.y).toBeGreaterThanOrEqual(
      messagesBox!.y + messagesBox!.height,
    );
    if (width === 390) {
      expect(conversationBox!.y).toBeGreaterThan(listBox!.y);
      expect(listBox!.height).toBeLessThan(350);
    } else {
      expect(conversationBox!.x).toBeGreaterThan(listBox!.x + listBox!.width);
    }
    const messages = page.getByRole('list', { name: 'Переписка' });
    await messages.press('End');
    await expect(messages).toBeFocused();
    await expect(messages).toHaveCSS('outline-width', '3px');
    await expect
      .poll(() => messages.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    await page
      .getByLabel('Ответ', { exact: true })
      .fill('Подскажем время занятия.');
    await expect(
      page.getByRole('button', { name: 'Отправить', exact: true }),
    ).toBeEnabled();
    await page.locator('.operator-request-button').nth(1).press('Enter');
    await expect(
      page.getByRole('button', { name: 'Повторить загрузку переписки' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Отправить', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Повторить загрузку переписки' })
      .press('Enter');
    await expect(page.locator('.operator-message-list li')).toHaveCount(24);
    await selected.press('Enter');
    await expect(page.getByLabel('Ответ', { exact: true })).toHaveValue(
      'Подскажем время занятия.',
    );
    await page.locator('.operator-request-button').nth(2).press('Enter');
    await expect(
      page.getByText('Сообщений пока нет.', { exact: true }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
  });
}
