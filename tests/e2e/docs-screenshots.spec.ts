import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { OperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

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

const content = {
  address: 'Учебный адрес: ул. Примерная, 10, зал 2.',
  customSections: [
    {
      label: 'Первое занятие',
      text: 'Возьмите удобную одежду, сменную обувь и воду. Приходите за 10 минут.',
    },
  ],
  faq: [
    {
      question: 'Можно без опыта?',
      answer: 'Да, начните с группы для новичков.',
    },
    {
      question: 'Как записаться?',
      answer: 'Напишите нам удобный день и направление.',
    },
    {
      question: 'Можно прийти без пары?',
      answer: 'Да, пару подберём на занятии.',
    },
  ],
  prices:
    'Пробное занятие — 500 ₽.\nРазовое — 900 ₽.\nАбонемент на 8 занятий — 5 600 ₽.',
  schedule:
    'North Side Dance · учебный пример\nПн / Ср, 19:00 — бачата с нуля\nВт / Чт, 20:00 — сальса\nСб, 12:00 — практика для всех групп',
  visibleSections: ['schedule', 'prices', 'address', 'faq'],
};

const runningChannel = {
  configured: true,
  lastSuccessfulPollAt: '2026-09-14T12:00:59.000Z',
  running: true,
  source: 'local',
  state: 'running',
} as const;

const operations: OperationsStatus = {
  channels: { telegram: runningChannel, vk: runningChannel },
  deliveries: {
    failed: 1,
    incidents: [
      {
        attempts: 5,
        channel: 'VK',
        createdAt: '2026-09-14T11:58:00.000Z',
        id: 'synthetic-delivery',
        operatorTopicId: 'synthetic-topic',
        outcomeUnknown: false,
        reason: 'Учебный пример: ответ не доставлен.',
        requestId: 'synthetic-request',
        retryAllowed: true,
      },
    ],
    oldestPendingAgeSeconds: 30,
    oldestPendingAt: '2026-09-14T12:00:30.000Z',
    pending: 3,
    state: 'failed',
    uncertain: 0,
    worker: {
      lastCycleAt: '2026-09-14T12:00:59.000Z',
      running: true,
      state: 'running',
    },
  },
  inboundEvents: { incidents: [], quarantined: 0, state: 'healthy' },
  intake: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
  observedAt: '2026-09-14T12:01:00.000Z',
  operatorRelays: { incidents: [], state: 'healthy', uncertain: 0 },
  outbound: { mode: 'active' },
  startedAt: '2026-09-14T08:01:00.000Z',
  state: 'attention',
  uptimeSeconds: 14_400,
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-14T12:01:00.000Z'));
  await page.route('**/api/manage/content', (route) =>
    route.fulfill({ json: { content, version: 'a'.repeat(64) } }),
  );
  await page.goto('/login');
  await page.getByLabel('Пароль').fill('synthetic-admin-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/manage$/);
});

test('documentation: populated content management', async ({ page }) => {
  await expect(page.locator('#schedule')).toHaveValue(content.schedule);
  await expect(page.locator('.content-summary')).toContainText('4 из 4');
  await expect(page.locator('.content-summary')).toContainText(
    'Частые вопросы',
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
    path: resolve(directory, filename),
  });
}
