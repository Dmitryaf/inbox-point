import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`editor and setup handle keyboard input and enlarged long text at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:4175/setup');
    const toggle = page.locator('[aria-controls="telegram-setup-details"]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#telegram-setup-details')).toBeVisible();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveCSS('outline-width', '3px');
    await toggle.press('Enter');
    await expect(page.locator('#telegram-setup-details')).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Сначала Telegram' }),
    ).toBeDisabled();
    await expect(page.locator('.status-pill').first()).toHaveCSS(
      'font-weight',
      '600',
    );

    await page.getByRole('link', { name: 'Ответы', exact: true }).click();
    const save = page.getByRole('button', { name: 'Сохранить', exact: true });
    await expect(save).toBeDisabled();
    const moveUp = page.getByRole('button', {
      name: 'Переместить направление 1 выше',
    });
    await expect(moveUp).toBeDisabled();
    const disabledBackground = await save.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await expect(moveUp).toHaveCSS('background-color', disabledBackground);
    await moveUp.hover();
    await expect(moveUp).toHaveCSS('background-color', disabledBackground);
    if (width === 390) {
      const firstFieldTop = await page
        .getByLabel('Направление / группа')
        .evaluate((el) => el.getBoundingClientRect().top + scrollY);
      expect(firstFieldTop).toBeLessThan(550);
    }

    // Models enlarged system text; does not claim browser zoom coverage.
    await page.route('**/test-enlarged-text.css', (route) =>
      route.fulfill({
        body: ':root { font-size: 125%; }',
        contentType: 'text/css',
      }),
    );
    await page.addStyleTag({ url: '/test-enlarged-text.css' });
    const title =
      'Бачата для начинающих — вечерняя группа с дополнительной практикой';
    await page.getByLabel('Направление / группа').fill(title);
    await page.getByLabel('Направление / группа').press('Tab');
    await expect(page.getByLabel('День / время')).toBeFocused();
    await expect(page.getByLabel('День / время')).toHaveCSS(
      'outline-width',
      '3px',
    );
    await page
      .getByLabel('Дополнительное описание')
      .fill(
        'Подходит тем, кто начинает с нуля. Возьмите сменную обувь и воду. '.repeat(
          8,
        ),
      );
    if (width >= 1100) {
      await expect(page.locator('.workspace-live-preview')).toBeVisible();
      await expect(page.locator('.workspace-live-preview')).toContainText(
        title,
      );
    } else {
      await expect(page.locator('.workspace-live-preview')).toBeHidden();
      await page.getByLabel('Режим', { exact: true }).selectOption('preview');
      await expect(page.locator('.preview')).toContainText(title);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(save).toBeEnabled();
  });
}
