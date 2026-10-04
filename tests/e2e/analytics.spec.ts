import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`analytics filters and chart remain usable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('http://127.0.0.1:4175/analytics');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Аналитика',
    );
    await expect(
      page.getByRole('link', { name: 'Аналитика', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.metric-value').first()).toHaveText('14');
    await expect(page.locator('.metric-value').nth(1)).toHaveText('83');
    await expect(
      page.getByRole('rowheader', { name: 'Цены', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('rowheader', {
        name: 'Записаться на первое пробное занятие',
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('main')).not.toContainText('synthetic-id');
    for (const [label, rows] of [
      ['7 дней', 7],
      ['90 дней', 90],
      ['30 дней', 30],
    ] as const) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.focus();
      await expect(button).toBeFocused();
      await page.keyboard.press('Space');
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await page
        .getByText('Показать значения по дням', { exact: true })
        .click();
      await expect(page.locator('.daily-values tbody tr')).toHaveCount(rows);
      await expect(page.locator('.activity-chart')).toBeVisible();
    }
    await page.getByRole('button', { name: 'Telegram', exact: true }).click();
    await expect(page.locator('.metric-value').first()).toHaveText('8');
    await expect(
      page.getByRole('columnheader', { name: 'VK', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'VK', exact: true }).click();
    await expect(page.locator('.metric-value').first()).toHaveText('6');
    await page.getByRole('button', { name: 'Все каналы', exact: true }).click();
    await expect(page.locator('.metric-value').first()).toHaveText('14');
    await expect(
      page.getByRole('columnheader', { name: 'Telegram', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`analytics-${width}.png`),
      fullPage: true,
    });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: '90 дней', exact: true }),
    ).toBeVisible();
  });
}

test('analytics loading, error retry and empty period stay understandable', async ({
  page,
}) => {
  let release!: () => void;
  let first = true;
  await page.route('**/api/analytics?*', async (route) => {
    if (first) {
      first = false;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({
        status: 503,
        json: { message: 'Synthetic failure' },
      });
    } else {
      await route.fulfill({
        json: { summary: { requests: 0, menuActions: 0 } },
      });
    }
  });
  await page.goto('http://127.0.0.1:4175/analytics');
  await expect(page.getByRole('status')).toContainText('Загружаем аналитику');
  release();
  await expect(page.getByRole('alert')).toContainText(
    'Не удалось загрузить аналитику',
  );
  await page.getByRole('button', { name: 'Повторить попытку' }).click();
  await expect(
    page.getByRole('heading', { name: 'Пока нет активности' }),
  ).toBeVisible();
  await expect(page.locator('.metric-value')).toHaveCount(0);
});

test('analytics uses the existing login and keeps API access closed after logout', async ({
  page,
}) => {
  expect((await page.request.get('/api/analytics')).status()).toBe(401);
  await page.goto('/analytics');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Пароль').fill('synthetic-admin-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.getByRole('link', { name: 'Аналитика', exact: true }).click();
  await page.reload();
  await expect(page.locator('.metric-value').first()).toHaveText('14');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  expect((await page.request.get('/api/analytics')).status()).toBe(401);
});
