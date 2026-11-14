import { expect, test } from '@playwright/test';
import { emergencyOperations } from '@test/e2e/support/design-fixtures.js';
import { login } from './support/auth.js';

for (const width of [390, 1280]) {
  test(`reads the 51st request and 201st message while retaining the draft at ${width}px`, async ({
    page,
  }, testInfo) => {
    const requests = Array.from({ length: 51 }, (_, index) => ({
      id: `request-${index}`,
      displayName: `Клиент ${index}`,
      channel: 'vk',
      status: 'active',
      createdAt: new Date(
        Date.UTC(2026, 8, 1, 12, 0, 51 - index),
      ).toISOString(),
    }));
    const messages = Array.from({ length: 201 }, (_, index) => ({
      id: `message-${index}`,
      direction: 'client_to_operator',
      text: `Сообщение ${index}`,
      createdAt: new Date(Date.UTC(2026, 8, 1, 12, 0, index)).toISOString(),
    }));
    await page.route('**/api/ops/**', async (route) => {
      const url = new URL(route.request().url());
      let body: unknown;
      if (url.pathname.endsWith('/status')) {
        body = emergencyOperations;
      } else if (url.pathname.endsWith('/service-control')) {
        body = {
          channels: { telegram: { mode: 'active' }, vk: { mode: 'active' } },
          delivery: { mode: 'active' },
        };
      } else if (url.pathname.endsWith('/requests')) {
        body = url.searchParams.has('cursor')
          ? { requests: requests.slice(50) }
          : { requests: requests.slice(0, 50), nextCursor: 'older-requests' };
      } else if (url.pathname.endsWith('/messages')) {
        body = url.searchParams.has('cursor')
          ? { messages: messages.slice(0, -200) }
          : { messages: messages.slice(-200), nextCursor: 'older-messages' };
      } else {
        throw new Error(`Unexpected synthetic route ${url.pathname}`);
      }
      await route.fulfill({ json: body });
    });
    await page.setViewportSize({ width, height: 900 });
    await login(page, '/ops');
    await page.getByRole('button', { name: 'Загрузить ещё обращения' }).click();
    const oldestRequest = page.getByRole('button', { name: /^Клиент 50 VK/ });
    await oldestRequest.click();
    await page
      .getByLabel('Ответ', { exact: true })
      .fill('Черновик для старого обращения');
    await page
      .getByRole('button', { name: 'Загрузить предыдущие сообщения' })
      .click();
    await expect(page.getByText('Сообщение 0', { exact: true })).toHaveCount(1);
    messages.push({
      id: 'incoming',
      direction: 'client_to_operator',
      text: 'Новое сообщение',
      createdAt: '2026-09-01T13:00:00Z',
    });
    await page.getByRole('button', { name: 'Обновить', exact: true }).click();
    await expect(
      page.getByText('Новое сообщение', { exact: true }),
    ).toHaveCount(1);
    await expect(page.getByText('Сообщение 0', { exact: true })).toHaveCount(1);
    await expect(oldestRequest).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Ответ', { exact: true })).toHaveValue(
      'Черновик для старого обращения',
    );
    await expect(
      page.getByRole('button', { name: 'Отправить', exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: testInfo.outputPath(`inbox-pagination-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
