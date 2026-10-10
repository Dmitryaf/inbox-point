import { expect, test, type Locator } from '@playwright/test';

async function contrast(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const luminance = (color: string) => {
      const channels = color
        .match(/[\d.]+/gu)!
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
      return (
        channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      );
    };
    const text = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (
      (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
    );
  });
}

async function gap(field: Locator, button: Locator): Promise<number> {
  const fieldBox = await field.boundingBox();
  const buttonBox = await button.boundingBox();
  return buttonBox!.y - fieldBox!.y - fieldBox!.height;
}

for (const width of [390, 1440]) {
  test(`class controls stay readable and preview follows the client at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/login');
    await page.getByLabel('Пароль').fill('synthetic-admin-password');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    const direction = page.locator('.class-list-item').first();
    const before = await direction.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    await direction.hover();
    await expect
      .poll(() =>
        direction.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        ),
      )
      .not.toBe(before);
    await expect.poll(() => contrast(direction)).toBeGreaterThanOrEqual(4.5);
    await direction.click();
    await page.locator('.class-list-item').first().click();
    await expect(
      page.getByLabel('Дни и время занятий', { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Добавить день и время' }),
    ).toHaveCount(0);
    await page.getByLabel('Открыть набор в группу', { exact: true }).check();
    await expect(page.getByLabel('Вопрос клиенту для записи')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Запись в группу' }),
    ).toContainText('бот покажет кнопку');
    await page.getByRole('button', { name: 'Добавить ключевое слово' }).click();
    const keyword = page.getByLabel('Слово или фраза 1');
    await keyword.fill('Тестовая группа');
    const removeWord = page.getByRole('button', {
      name: 'Удалить слово',
      exact: true,
    });
    await removeWord.hover();
    await expect.poll(() => contrast(removeWord)).toBeGreaterThanOrEqual(4.5);
    expect(await gap(keyword, removeWord)).toBeGreaterThanOrEqual(12);
    await page.getByText('Дополнительные настройки', { exact: true }).click();
    const removeGroup = page.getByRole('button', {
      name: 'Удалить группу',
      exact: true,
    });
    await removeGroup.hover();
    await expect.poll(() => contrast(removeGroup)).toBeGreaterThanOrEqual(4.5);
    expect(
      await gap(page.getByLabel('Направление', { exact: true }), removeGroup),
    ).toBeGreaterThanOrEqual(12);
    await expect(
      page.getByText(
        'Во время переписки с администратором слово остаётся обычным сообщением.',
      ),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath('controls.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Посмотреть как клиент' }).click();
    await expect(page.locator('.preview')).toHaveCount(1);
    await expect(page.locator('.preview-service-message')).toContainText(
      'Понедельник',
    );
    await expect(
      page.getByRole('button', { name: 'Расписание группы', exact: true }),
    ).toHaveCount(0);
    await page
      .locator('.preview')
      .getByRole('button', { name: 'Записаться на занятие' })
      .click();
    await expect(page.locator('.preview-service-message')).toContainText(
      'Как к вам обращаться',
    );
    await page.getByRole('button', { name: 'Начать с меню' }).click();
    await page
      .locator('.preview')
      .getByRole('button', { name: 'Расписание', exact: true })
      .click();
    await page
      .locator('.preview')
      .getByRole('button', { name: 'Расписание всех направлений', exact: true })
      .click();
    await expect(page.locator('.preview-service-message')).toContainText(
      'Понедельник',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('preview.png'),
      fullPage: true,
    });
  });
}
