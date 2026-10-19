import { expect, test } from '@playwright/test';
import { login } from './support/auth.js';

test.use({ baseURL: 'http://127.0.0.1:4192' });
test.describe.configure({ mode: 'default' });
const token = 'synthetic-channel-access-token';
for (const width of [390, 1280]) {
  test(`channel connect → persisted reload → failed/cancelled disconnect → ordered disconnect preserves history at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await login(page, '/setup');
    const original = (await (
      await page.request.get('/api/test/state')
    ).json()) as { request: unknown; messages: unknown; effects: string[] };
    await expect(
      page.getByRole('button', { name: 'Сначала Telegram' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Подключить Telegram' }).focus();
    await page.keyboard.press('Enter');
    await page
      .getByLabel('Токен бота — строка-пароль от @BotFather')
      .fill(token);
    await page
      .getByRole('button', { name: 'Проверить токен и найти группу' })
      .click();
    await page.getByLabel('Группа без тем — включите темы').check();
    await page
      .getByRole('button', { name: 'Подключить Telegram', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      'Включите в выбранной группе темы',
    );
    await page
      .getByLabel(
        'Группа сотрудников с длинным названием для проверки интерфейса',
      )
      .check();
    await page.screenshot({
      path: testInfo.outputPath(`telegram-discovery-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Подключить Telegram', exact: true })
      .click();
    await expect(page.getByText('Подключение активно.')).toBeVisible();
    await page
      .getByRole('button', { name: 'Подключить VK', exact: true })
      .click();
    await page
      .getByLabel('Ссылка на страницу сообщества VK')
      .fill('https://vk.com/synthetic');
    await page
      .getByLabel('Ключ с правами управления и сообщений')
      .fill('synthetic-missing-messages-token');
    await page
      .getByRole('button', { name: 'Подключить VK', exact: true })
      .click();
    await expect(page.getByRole('alert')).toContainText(
      '«Сообщения сообщества»',
    );
    await page.getByLabel('Ключ с правами управления и сообщений').fill(token);
    await page.screenshot({
      path: testInfo.outputPath(`vk-rights-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole('button', { name: 'Подключить VK', exact: true })
      .click();
    await expect(page.getByText('Подключение активно.')).toHaveCount(2);
    expect(await page.locator('input[type="password"]').count()).toBe(0);
    await page.reload();
    await expect(page.getByText('Подключён', { exact: true })).toHaveCount(2);
    const connected = (await (
      await page.request.get('/api/test/state')
    ).json()) as {
      telegramSaved: boolean;
      vkSaved: boolean;
      request: unknown;
      effects: string[];
    };
    expect(connected).toMatchObject({
      telegramSaved: true,
      vkSaved: true,
      request: original.request,
      messages: original.messages,
    });
    for (const name of ['Telegram', 'VK']) {
      await page
        .getByRole('region', { name, exact: true })
        .getByRole('button', { name: 'Сведения' })
        .click();
    }
    await expect(
      page.getByRole('button', { name: 'Отключить Telegram' }),
    ).toBeDisabled();
    page.once('dialog', (dialog) => void dialog.dismiss());
    await page.getByRole('button', { name: 'Отключить VK' }).click();
    await expect(page.getByText('Подключён', { exact: true })).toHaveCount(2);
    await page.route('**/api/setup/vk', (route) =>
      route.fulfill({
        status: 500,
        json: { message: 'Не удалось отключить VK.' },
      }),
    );
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Отключить VK' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Не удалось отключить VK.',
    );
    await expect(page.getByText('Подключён', { exact: true })).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath(`disconnect-error-${width}.png`),
      fullPage: true,
    });
    await page.unroute('**/api/setup/vk');
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Отключить VK' }).click();
    await expect(
      page.getByRole('button', { name: 'Отключить Telegram' }),
    ).toBeEnabled();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Отключить Telegram' }).click();
    await expect(page.getByText('Не подключён', { exact: true })).toHaveCount(
      2,
    );
    await page.reload();
    await expect(page.getByText('Не подключён', { exact: true })).toHaveCount(
      2,
    );
    const disconnected = (await (
      await page.request.get('/api/test/state')
    ).json()) as {
      telegramSaved: boolean;
      vkSaved: boolean;
      request: unknown;
      effects: string[];
    };
    expect(disconnected).toMatchObject({
      telegramSaved: false,
      vkSaved: false,
      request: original.request,
      messages: original.messages,
    });
    expect(disconnected.effects.slice(original.effects.length)).toEqual([
      'telegram:start',
      'vk:start',
      'vk:stop',
      'telegram:stop',
    ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        JSON.stringify({ ...sessionStorage, ...localStorage }),
      ),
    ).not.toContain(token);
    expect(errors).toEqual([]);
  });
}
