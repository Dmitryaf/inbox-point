import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`serves the isolated React entry through Fastify at ${width}px`, async ({
    page,
    request,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto('/manage');
    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-security-policy']).toContain(
      "script-src 'self'",
    );
    await expect(
      page.getByRole('heading', { name: 'Вход в управление' }),
    ).toBeVisible();
    await expect(
      page.getByText('Введите пароль администратора.'),
    ).toBeVisible();
    expect(await page.getByRole('main').getAttribute('class')).toBeTruthy();
    expect(
      await page
        .locator('form')
        .evaluate((element) => getComputedStyle(element).display),
    ).toBe('grid');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const api = await request.get('/api/manage/content');
    expect(api.status()).toBe(401);
    await expect(
      page.getByRole('heading', { name: 'Вход в управление' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`react-entry-${width}.png`),
      fullPage: true,
    });
  });
}
