import { expect, test, type Locator } from '@playwright/test';
async function hover(locator: Locator): Promise<void> {
  await locator.hover();
  await locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );
}
test('workspace navigation keeps its text readable in selected and hovered states', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:4175/manage');
  const edit = page.getByRole('button', {
    name: 'Редактирование',
    exact: true,
  });
  await expect(edit).toHaveAttribute('aria-pressed', 'true');
  await hover(edit);
  await expect(edit).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(edit).toHaveCSS('color', 'rgb(67, 56, 202)');
  const preview = page.getByRole('button', {
    name: 'Предпросмотр',
    exact: true,
  });
  await hover(preview);
  await expect(preview).toHaveCSS('background-color', 'rgb(243, 245, 248)');
  await expect(preview).toHaveCSS('color', 'rgb(31, 41, 55)');
  const classes = page.getByRole('button', { name: 'Занятия', exact: true });
  await hover(classes);
  await expect(classes).toHaveCSS('background-color', 'rgb(238, 242, 255)');
  await expect(classes).toHaveCSS('color', 'rgb(67, 56, 202)');
  await hover(edit);
  await page.screenshot({
    path: testInfo.outputPath('workspace-navigation-hover.png'),
    fullPage: true,
  });
});
