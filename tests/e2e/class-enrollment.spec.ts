import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`teachers configure a class and keyword, save and reopen at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let content = {
      address: '',
      prices: 'Пробное занятие — 500',
      schedule: '',
      scheduleItems: [] as unknown[],
      directions: [] as unknown[],
      groups: [] as unknown[],
      keywords: [] as unknown[],
    };
    let version = 'a'.repeat(64);
    await page.route('**/api/manage/content', async (route) => {
      if (route.request().method() === 'POST') {
        content = (
          route.request().postDataJSON() as { content: typeof content }
        ).content;
        version = 'b'.repeat(64);
      }
      await route.fulfill({ json: { content, version } });
    });
    await page.goto('/manage');
    await page.getByLabel('Пароль').fill('synthetic-admin-password');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page
      .getByLabel('Новое направление', { exact: true })
      .fill('Тестовый танец');
    await page
      .getByRole('button', { name: 'Добавить направление', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Добавить группу', exact: true })
      .click();
    await page
      .getByLabel('Название группы', { exact: true })
      .fill('Начинающие');
    await page
      .getByLabel('День и время 1', { exact: true })
      .fill('Понедельник, 19:00');
    await page
      .getByRole('button', { name: 'Добавить день и время', exact: true })
      .click();
    await page
      .getByLabel('День и время 2', { exact: true })
      .fill('Четверг, 19:00');
    await page.getByLabel('Открыть набор в группу', { exact: true }).check();
    await page
      .getByRole('button', { name: 'Добавить ключевое слово', exact: true })
      .click();
    await page
      .getByLabel('Слово или фраза 1', { exact: true })
      .fill('Тестовый танец');
    await expect(page.getByLabel('Что открыть')).toHaveValue(/^group:/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('classes-editor.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Все изменения сохранены')).toBeVisible();
    expect(content.groups).toEqual([
      expect.objectContaining({
        name: 'Начинающие',
        enrollmentOpen: true,
        meetings: ['Понедельник, 19:00', 'Четверг, 19:00'],
      }),
    ]);
    await page.reload();
    await expect(
      page.getByLabel('Слово или фраза 1', { exact: true }),
    ).toHaveValue('Тестовый танец');
    await page
      .locator('.class-card > summary')
      .filter({ hasText: 'Начинающие' })
      .first()
      .click();
    await page.getByText('Что увидит клиент', { exact: true }).click();
    await expect(page.locator('.class-preview pre')).toContainText(
      'Тестовый танец / Начинающие',
    );
    await page
      .locator('.class-preview')
      .getByRole('button', { name: 'Записаться на занятие', exact: true })
      .click();
    await expect(page.locator('.class-preview pre')).toContainText(
      'Как к вам обращаться',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('classes-preview.png'),
      fullPage: true,
    });
  });
}
