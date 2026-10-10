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
      .getByRole('button', { name: 'Добавить направление', exact: true })
      .click();
    await page
      .getByLabel('Новое направление', { exact: true })
      .fill('Тестовый танец');
    await page
      .getByRole('button', { name: 'Создать направление', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Добавить группу', exact: true })
      .click();
    await page
      .getByLabel('Название группы', { exact: true })
      .fill('Начинающие');
    await page
      .getByLabel('Дни и время занятий', { exact: true })
      .fill('Пн 19:00, Чт 19:00');
    await page.getByLabel('Открыть набор в группу', { exact: true }).check();
    await page
      .getByRole('button', { name: 'Добавить ключевое слово', exact: true })
      .click();
    await page
      .getByLabel('Слово или фраза 1', { exact: true })
      .fill('Тестовый танец');
    await expect(page.getByLabel('Что открыть')).toHaveCount(0);
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
        meetings: ['Пн 19:00, Чт 19:00'],
      }),
    ]);
    // The selected group and unsaved fields also survive section/view changes.
    if (width >= 900) {
      await page
        .getByRole('button', { name: 'Информация', exact: true })
        .click();
      await page.getByRole('button', { name: 'Занятия', exact: true }).click();
    } else {
      await page.getByLabel('Раздел', { exact: true }).selectOption('faq');
      await page.getByLabel('Раздел', { exact: true }).selectOption('core');
    }
    await expect(
      page.getByLabel('Дни и время занятий', { exact: true }),
    ).toHaveValue('Пн 19:00, Чт 19:00');
    await page.reload();
    await page
      .locator('.class-list-item')
      .filter({ hasText: 'Тестовый танец' })
      .click();
    await page
      .locator('.class-list-item')
      .filter({ hasText: 'Начинающие' })
      .click();
    await expect(
      page.getByLabel('Слово или фраза 1', { exact: true }),
    ).toHaveValue('Тестовый танец');
    await page
      .getByRole('button', { name: 'Посмотреть как клиент', exact: true })
      .click();
    await expect(page.locator('.preview-service-message')).toContainText(
      'Тестовый танец / Начинающие',
    );
    await page
      .locator('.preview')
      .getByRole('button', { name: 'Записаться на занятие', exact: true })
      .click();
    await expect(page.locator('.preview-service-message')).toContainText(
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
