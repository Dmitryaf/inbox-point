import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`organization, group keywords and information gaps at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    let snapshot = {
      version: 'a'.repeat(64),
      content: {
        organizationName: '',
        address: 'ул. Примерная, 10',
        prices: '600',
        schedule: '',
        scheduleItems: [],
        faq: [{ question: 'Что взять?', answer: 'Удобную обувь' }],
        directions: [{ id: 'dance', name: 'Бачата' }],
        groups: [
          {
            id: 'beginners',
            directionId: 'dance',
            name: 'Начинающие',
            meetings: ['Пн/Ср — 20:00'],
            description: '',
            enrollmentOpen: true,
            applicationQuestion: '',
          },
        ],
        keywords: [
          { phrase: 'Бачата', targetType: 'direction', targetId: 'dance' },
        ],
      },
    };
    await page.route('**/api/manage/content', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as typeof snapshot;
        expect(body.version).toBe(snapshot.version);
        snapshot = { content: body.content, version: 'b'.repeat(64) };
      }
      await route.fulfill({ json: snapshot });
    });
    await page.goto('/login');
    await page.getByLabel('Пароль').fill('synthetic-admin-password');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.locator('.class-list-item').first().click();
    await expect(
      page.getByRole('region', { name: 'Переход из объявления' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Добавить ключевое слово' }),
    ).toHaveCount(0);
    await page.locator('.class-list-item').first().click();
    await page
      .getByRole('button', { name: 'Использовать «Бачата» для этой группы' })
      .click();
    await page.getByLabel('Название организации').fill('Школа танцев «Пример»');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.locator('.organization-name')).toHaveText(
      'Школа танцев «Пример»',
    );
    expect(snapshot.content.keywords).toEqual([
      { phrase: 'Бачата', targetType: 'group', targetId: 'beginners' },
    ]);
    await page.reload();
    await expect(page.getByLabel('Название организации')).toHaveValue(
      'Школа танцев «Пример»',
    );
    for (const section of ['Каналы', 'Аналитика', 'Мониторинг', 'Ответы']) {
      await page
        .getByRole('navigation', { name: 'Разделы администратора' })
        .getByRole('link', { name: section, exact: true })
        .click();
      await expect(page.locator('.organization-name')).toHaveText(
        'Школа танцев «Пример»',
      );
      await page.reload();
      await expect(page.locator('.organization-name')).toHaveText(
        'Школа танцев «Пример»',
      );
    }
    if (width >= 900) {
      await page
        .getByRole('button', { name: 'Информация', exact: true })
        .click();
    } else {
      await page.getByLabel('Раздел', { exact: true }).selectOption('faq');
    }
    const address = page
      .locator('details')
      .filter({ has: page.locator('summary strong', { hasText: /^Адрес$/ }) });
    const faq = page.locator('section.card').filter({
      has: page.getByRole('heading', { name: 'Частые вопросы', exact: true }),
    });
    for (const expanded of [false, true, false]) {
      if (((await address.getAttribute('open')) !== null) !== expanded) {
        await address.locator('summary').click();
      }
      const first = (await address.boundingBox())!;
      const second = (await faq.boundingBox())!;
      const gap = second.y - first.y - first.height;
      expect(gap).toBeGreaterThanOrEqual(12);
      expect(gap).toBeLessThanOrEqual(24);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('organization-information.png'),
      fullPage: true,
    });
  });
}
