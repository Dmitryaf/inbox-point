import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import {
  attentionOperations as operations,
  designContent as content,
} from './support/design-fixtures.js';

// Uses the existing local E2E server; no channel credentials or real accounts.
// Export: UPDATE_DOCS_SCREENSHOTS=1 npm run check:e2e -- docs-screenshots.spec.ts
// PowerShell: $env:UPDATE_DOCS_SCREENSHOTS='1'; npm.cmd run check:e2e -- docs-screenshots.spec.ts
// Normal E2E runs write only to test-results, leaving documentation assets intact.
// Install Chromium with `npx playwright install chromium` first. To use an
// installed Edge instead, set PLAYWRIGHT_CHANNEL=msedge (supported by the config).
test.use({
  colorScheme: 'light',
  deviceScaleFactor: 1,
  locale: 'ru-RU',
  reducedMotion: 'reduce',
  timezoneId: 'UTC',
  viewport: { width: 1280, height: 1000 },
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T12:01:00.000Z'));
  await page.route('**/api/manage/content', (route) =>
    route.fulfill({ json: { content, version: 'a'.repeat(64) } }),
  );
  await page.goto('/login');
  await page.getByLabel('Пароль').fill('synthetic-admin-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/manage$/);
});

test('documentation: populated content management', async ({ page }) => {
  await expect(page.locator('#schedule-title-0')).toHaveValue(
    content.scheduleItems[0]!.title,
  );
  await expect(page.locator('#schedule-day-time-0')).toHaveValue(
    content.scheduleItems[0]!.dayTime,
  );
  await expect(page.locator('.workspace-live-preview')).toContainText(
    'Бачата с нуля',
  );
  await expect(page.locator('.workspace-live-preview')).toContainText(
    'Частые вопросы',
  );
  await expect(page.locator('.content-summary')).toContainText(
    'Ответов в меню: 5',
  );
  await capture(page, 'inbox-point-content.png');
});

test('documentation: delivery incident and service overview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1092 });
  await page.route('**/api/ops/status', (route) =>
    route.fulfill({ json: operations }),
  );
  await page.goto('/ops');
  await expect(
    page.getByRole('button', { name: 'Повторить отправку' }),
  ).toBeVisible();
  await expect(page.locator('.status-grid')).toContainText('VK');
  await expect(page.locator('.service-summary')).toContainText(
    'Нужно проверить',
  );
  await expect(page.locator('.delivery-incidents')).toContainText(
    'Учебный клиент',
  );
  await expect(page.locator('.delivery-incidents')).toContainText(
    'Приходите в понедельник',
  );
  await capture(page, 'inbox-point-operations.png');
});

async function capture(page: Page, filename: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.mouse.move(0, 0);
  const directory =
    process.env.UPDATE_DOCS_SCREENSHOTS === '1'
      ? resolve('docs/screenshots')
      : test.info().outputPath('screenshots');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    animations: 'disabled',
    fullPage: filename === 'inbox-point-operations.png',
    path: resolve(directory, filename),
  });
}
