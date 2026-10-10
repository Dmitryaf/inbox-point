import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`old schedule can open enrollment and duplicate can be deleted at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const source = 'Группа для новичков\nПн/Ср 20:00\nМожно с нуля';
    let content = {
      schedule: '',
      scheduleItems: [],
      directions: [{ id: 'dance', name: 'Тестовый танец' }],
      groups: [
        {
          id: 'ready',
          directionId: 'dance',
          name: 'Начинающие',
          meetings: ['Пн 19:00'],
          description: '',
          applicationQuestion: '',
          enrollmentOpen: true,
        },
        {
          id: 'old',
          directionId: 'dance',
          name: 'Начинающие',
          meetings: ['Пн/Ср 20:00'],
          description: 'Можно с нуля',
          applicationQuestion: '',
          enrollmentOpen: false,
          review: { source },
        },
      ],
      keywords: [],
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
    await page.goto('/login');
    await page.getByLabel('Пароль').fill('synthetic-admin-password');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page
      .getByRole('button', { name: 'Старые записи расписания: 1' })
      .click();
    await page.locator('.class-list-item').click();
    await expect(page.locator('.class-review pre')).toHaveText(source);
    await expect(page.locator('.class-review')).toContainText('уже есть');
    const checkbox = page.getByLabel('Открыть набор в группу');
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expect(page.locator('.class-review pre')).toHaveText(source);
    await expect(
      page.getByRole('button', { name: 'Подтвердить данные' }),
    ).toHaveCount(0);
    const remove = page.getByRole('button', {
      name: 'Удалить группу',
      exact: true,
    });
    await expect(remove).toBeVisible();
    page.once('dialog', (dialog) => dialog.dismiss());
    await remove.click();
    await expect(page.getByLabel('Название группы')).toHaveValue('Начинающие');
    await page.getByLabel('Название группы').fill('Новая группа');
    await checkbox.check();
    await expect(page.locator('.class-review')).toHaveCount(0);
    await expect(checkbox).toBeChecked();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Все изменения сохранены')).toBeVisible();
    expect(
      content.groups.find((group) => group.id === 'old')?.enrollmentOpen,
    ).toBe(true);
    await page.reload();
    await page.locator('.class-list-item').click();
    await page
      .getByRole('button', { name: 'Новая группа Набор открыт' })
      .click();
    await expect(page.getByLabel('Дни и время занятий')).toHaveValue(
      'Пн/Ср 20:00',
    );
    await expect(checkbox).toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath('completed-group.png'),
      fullPage: true,
    });
    page.once('dialog', (dialog) => dialog.accept());
    await remove.click();
    await expect(
      page.getByRole('button', { name: 'Новая группа Набор открыт' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByText('Все изменения сохранены')).toBeVisible();
    await page.reload();
    await page.locator('.class-list-item').click();
    await expect(page.locator('.class-list-item')).toHaveCount(1);
    await expect(page.locator('.class-list-item')).toHaveText(
      'НачинающиеНабор открыт',
    );
    expect(content.groups.map((group) => group.id)).toEqual(['ready']);
  });
}
