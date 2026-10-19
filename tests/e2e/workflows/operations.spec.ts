import { expect, test } from '@playwright/test';
import { login } from './support/auth.js';
import { operationsEvidence } from './support/operations.js';

for (const [width, port] of [
  [390, 4193],
  [1280, 4194],
] as const) {
  test.describe(`operations ${width}px`, () => {
    test.use({ baseURL: `http://127.0.0.1:${port}` });
    test(`real inbox, idempotent retry, polling, controls and incident resolutions at ${width}px`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await page.clock.install();
      await login(page, '/ops');
      const initial = await operationsEvidence(page);
      const idA = initial.ids[0]!;
      const idB = initial.ids[1]!;
      await page.getByRole('button', { name: /^Клиент A/ }).click();
      await expect(page.getByText(/^Message A\./)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Клиент A/ })).toHaveCSS(
        'background-color',
        'rgb(238, 242, 255)',
      );
      await page.screenshot({
        path: testInfo.outputPath(`operations-${width}.png`),
        fullPage: true,
      });
      const conversation = page.getByRole('list', { name: 'Переписка' });
      const node = await conversation.elementHandle();
      await conversation.evaluate((element) => {
        element.scrollTop = 120;
      });
      await conversation.focus();
      let statusReads = 0;
      page.on('request', (request) => {
        if (request.url().endsWith('/api/ops/status')) {
          statusReads++;
        }
      });
      await page.clock.fastForward(30_000);
      await expect.poll(() => statusReads).toBe(1);
      await expect(
        page.getByRole('button', { name: 'Обновить', exact: true }),
      ).toBeEnabled();
      expect(
        await conversation.evaluate(
          (element, previous) => element === previous,
          node,
        ),
      ).toBe(true);
      expect(await conversation.evaluate((element) => element.scrollTop)).toBe(
        120,
      );
      await expect(conversation).toBeFocused();
      await page.clock.resume();
      await page
        .getByLabel('Ответ', { exact: true })
        .fill('Отправленный снимок A');
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(`**/requests/${idA}/replies`, async (route) => {
        const result = await route.fetch();
        await gate;
        await route.fulfill({ response: result });
      });
      await page
        .getByRole('button', { name: 'Отправить', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Готовим к отправке…' }),
      ).toBeDisabled();
      await page.getByLabel('Ответ', { exact: true }).fill('Новый черновик A');
      await page.getByRole('button', { name: /^Клиент B/ }).click();
      await expect(page.getByText(/^Message B\./)).toBeVisible();
      await page.getByLabel('Ответ', { exact: true }).fill('Черновик B');
      release();
      await expect(page.getByText(/Ответ сохранён для отправки/)).toBeVisible();
      await expect(page.getByLabel('Ответ', { exact: true })).toHaveValue(
        'Черновик B',
      );
      await page.unroute(`**/requests/${idA}/replies`);
      await page.getByRole('button', { name: /^Клиент A/ }).click();
      await expect(page.getByLabel('Ответ', { exact: true })).toHaveValue(
        'Новый черновик A',
      );
      await expect(
        page.getByText('Отправленный снимок A', { exact: true }),
      ).toHaveCount(1);
      const queued = (await operationsEvidence(page)).pending.filter(
        (delivery) => delivery.text === 'Отправленный снимок A',
      );
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        requestId: idA,
        conversationId: '101',
      });
      let attempts = 0;
      const keys: string[] = [];
      await page.route(`**/requests/${idA}/replies`, async (route) => {
        keys.push(
          (route.request().postDataJSON() as { idempotencyKey: string })
            .idempotencyKey,
        );
        attempts++;
        if (attempts === 1) {
          await route.fetch();
          await route.abort('connectionfailed');
        } else {
          await route.continue();
        }
      });
      await page
        .getByLabel('Ответ', { exact: true })
        .fill('Один ответ при потерянном подтверждении');
      await page
        .getByRole('button', { name: 'Отправить', exact: true })
        .click();
      await expect(page.getByRole('alert')).toBeVisible();
      await page.getByRole('button', { name: /^Клиент B/ }).click();
      await expect(page.getByText(/^Message B\./)).toBeVisible();
      await page.getByLabel('Ответ', { exact: true }).fill('Отдельный ответ B');
      await page
        .getByRole('button', { name: 'Отправить', exact: true })
        .click();
      await expect(
        page.getByText('Отдельный ответ B', { exact: true }),
      ).toHaveCount(1);
      await page.getByRole('button', { name: /^Клиент A/ }).click();
      await expect(page.getByLabel('Ответ', { exact: true })).toHaveValue(
        'Один ответ при потерянном подтверждении',
      );
      await page
        .getByRole('button', { name: 'Отправить', exact: true })
        .click();
      await expect(page.getByLabel('Ответ', { exact: true })).toHaveValue('');
      expect(keys).toHaveLength(2);
      expect(keys[1]).toBe(keys[0]);
      expect(
        (await operationsEvidence(page)).pending.filter(
          (delivery) =>
            delivery.text === 'Один ответ при потерянном подтверждении',
        ),
      ).toHaveLength(1);
      await page.unroute(`**/requests/${idA}/replies`);
      await page.getByText('Управление сообщениями', { exact: true }).click();
      const intake = page.getByRole('region', {
        name: 'Новые обращения',
        exact: true,
      });
      page.once('dialog', (dialog) => void dialog.accept());
      await intake
        .getByRole('button', { name: 'Приостановить', exact: true })
        .first()
        .click();
      await expect(
        intake.getByRole('button', { name: 'Возобновить' }),
      ).toBeEnabled();
      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: 'Приостановить ответы' }).click();
      await expect(
        page.getByRole('button', { name: 'Возобновить ответы' }),
      ).toBeEnabled();
      expect((await operationsEvidence(page)).control).toMatchObject({
        channels: { telegram: { mode: 'paused' } },
        delivery: { mode: 'paused' },
      });
      await page.reload();
      await page.getByText('Управление сообщениями', { exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Возобновить ответы' }),
      ).toBeVisible();
      await intake.getByRole('button', { name: 'Возобновить' }).click();
      await page.getByRole('button', { name: 'Возобновить ответы' }).click();
      await expect(
        page.getByRole('button', { name: 'Приостановить ответы' }),
      ).toBeEnabled();
      page.once('dialog', (dialog) => void dialog.accept());
      await page
        .getByRole('button', { name: 'Повторить отправку', exact: true })
        .click();
      await expect
        .poll(async () =>
          (await operationsEvidence(page)).failed.some(
            (delivery) => delivery.id === 'delivery-failed',
          ),
        )
        .toBe(false);
      page.once('dialog', (dialog) => void dialog.accept());
      await page
        .getByRole('button', { name: 'Сообщение получено', exact: true })
        .click();
      await expect
        .poll(async () => (await operationsEvidence(page)).failed.length)
        .toBe(0);
      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: 'Тема осталась открыта' }).click();
      await expect(
        page.getByText('Действия в Telegram', { exact: true }),
      ).toHaveCount(0);
      page.once('dialog', (dialog) => void dialog.accept());
      await page
        .getByRole('button', { name: 'Не обрабатывать', exact: true })
        .click();
      await expect(
        page.getByText('Необработанные сообщения и действия', { exact: true }),
      ).toHaveCount(0);
      await page.getByRole('button', { name: /^Клиент A/ }).click();
      page.once('dialog', (dialog) => void dialog.dismiss());
      await page.getByRole('button', { name: 'Закрыть обращение' }).click();
      await expect(
        page.getByRole('button', { name: /^Клиент A/ }),
      ).toBeVisible();
      page.once('dialog', (dialog) => void dialog.accept());
      await page.getByRole('button', { name: 'Закрыть обращение' }).click();
      await expect(page.getByRole('button', { name: /^Клиент A/ })).toHaveCount(
        0,
      );
      const recovered = await page.request.post(`/api/test/recover/${idB}`, {
        data: {},
        headers: { Origin: `http://127.0.0.1:${port}` },
      });
      expect(await recovered.json()).toEqual({ changed: true });
      await page.getByRole('button', { name: 'Обновить', exact: true }).click();
      await expect(page.getByRole('button', { name: /^Клиент B/ })).toHaveCount(
        0,
      );
      const rejected = await page.request.post(
        `/api/ops/inbox/requests/${idB}/replies`,
        {
          data: { text: 'Obsolete reply', idempotencyKey: 'obsolete-reply' },
          headers: { Origin: `http://127.0.0.1:${port}` },
        },
      );
      expect(rejected.status()).toBe(404);
      expect(
        (await operationsEvidence(page)).pending.some(
          (delivery) => delivery.text === 'Obsolete reply',
        ),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(`operations-resolved-${width}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
