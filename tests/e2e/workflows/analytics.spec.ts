import { expect, test } from '@playwright/test';
import { login } from './support/auth.js';

for (const width of [390, 1280]) {
  test(`analytics real SQLite report, filters, retry and chart/table at ${width}px`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.getByRole('link', { name: 'Аналитика' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('article')).toBeVisible();
    await expect(page.locator('dd').filter({ hasText: /^14$/ })).toBeVisible();
    await expect(
      page.getByRole('cell', { name: '83', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('rowheader', {
        name: 'Записаться на первое пробное занятие',
      }),
    ).toBeVisible();
    if (width === 1280) {
      await expect(page.getByRole('img')).toBeVisible();
      await page
        .getByRole('button', { name: 'Показать значения по дням' })
        .click();
    }
    await expect(
      page.getByRole('table', { name: 'Активность по дням' }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`analytics-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'VK', exact: true }).click();
    await expect(page.locator('dd').filter({ hasText: /^6$/ })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Telegram' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '90 дней' }).click();
    await expect(page.getByRole('button', { name: '90 дней' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('article')).toBeVisible();
    await page.route('**/api/analytics?period=7d*', (route) =>
      route.fulfill({ status: 503, json: {} }),
    );
    await page.getByRole('button', { name: '7 дней' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Не удалось загрузить аналитику',
    );
    await page.unroute('**/api/analytics?period=7d*');
    await page.getByRole('button', { name: 'Повторить попытку' }).click();
    await expect(page.getByRole('article')).toBeVisible();
    await page.route('**/api/analytics?period=30d*', (route) =>
      route.fulfill({ json: { summary: { requests: 0, menuActions: 0 } } }),
    );
    await page.getByRole('button', { name: '30 дней' }).click();
    await expect(page.getByText('Пока нет активности')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}
