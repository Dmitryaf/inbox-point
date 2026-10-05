import { expect, test } from '@playwright/test';
import type { OperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

for (const width of [390, 1280]) {
  test(`channel diagnostics stay readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.request.get(
      'http://127.0.0.1:4175/api/ops/status',
    );
    const status = (await response.json()) as OperationsStatus;
    status.channels.telegram = {
      configured: true,
      running: false,
      source: 'local',
      state: 'poll_failed',
      consecutiveFailures: 3,
      lastFailedPollAt: '2026-10-05T12:00:00Z',
      lastFailure: {
        stage: 'startup',
        request: {
          channel: 'telegram',
          kind: 'transport',
          method: 'getMe',
          durationMs: 15000,
          operationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          transportCodes: ['UND_ERR_CONNECT_TIMEOUT'],
        },
      },
    };
    await page.route('**/api/ops/status', (route) =>
      route.fulfill({ json: status }),
    );
    await page.goto('http://127.0.0.1:4175/ops');
    const card = page.locator('.status-card').filter({
      has: page.getByRole('heading', { name: 'Telegram', exact: true }),
    });
    await expect(card).toContainText('Ошибка связи');
    await expect(
      card.getByText('UND_ERR_CONNECT_TIMEOUT', { exact: true }),
    ).toBeHidden();
    await card.getByText('Технические данные', { exact: true }).click();
    await expect(
      card.getByText('UND_ERR_CONNECT_TIMEOUT', { exact: true }),
    ).toBeVisible();
    await expect(card).toContainText('15000 мс');
    expect(
      await card.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/error-diagnostics/screenshots/ops-diagnostics-${width}.png`,
      fullPage: true,
    });
  });
}
