import { expect, type Locator, type Page } from '@playwright/test';

export async function enlargeText(page: Page): Promise<void> {
  // A same-origin stylesheet respects the application's CSP. Models text scaling, not browser zoom.
  await page.route('**/test-enlarged-text.css', (route) =>
    route.fulfill({
      body: ':root { font-size: 125%; }',
      contentType: 'text/css',
    }),
  );
  await page.addStyleTag({ url: '/test-enlarged-text.css' });
  await expect(page.locator('html')).toHaveCSS('font-size', '20px');
}

export async function noHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

export async function documentTop(locator: Locator): Promise<number> {
  return locator.evaluate(
    (element) => element.getBoundingClientRect().top + scrollY,
  );
}
