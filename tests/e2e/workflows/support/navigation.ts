import { type Page } from '@playwright/test';
export async function editorSection(
  page: Page,
  section: 'core' | 'faq' | 'custom',
) {
  const labels = {
    core: 'Занятия',
    faq: 'Информация',
    custom: 'Дополнительные кнопки',
  };
  if ((page.viewportSize()?.width ?? 1280) < 900) {
    await page.getByLabel('Раздел', { exact: true }).selectOption(section);
  } else {
    await page
      .getByRole('button', { name: labels[section], exact: true })
      .click();
  }
}
export async function editorView(
  page: Page,
  view: 'edit' | 'preview' | 'history',
) {
  const labels = {
    edit: 'Редактирование',
    preview: 'Предпросмотр',
    history: 'История',
  };
  if ((page.viewportSize()?.width ?? 1280) < 900) {
    await page.getByLabel('Режим', { exact: true }).selectOption(view);
  } else {
    await page.getByRole('button', { name: labels[view], exact: true }).click();
  }
}
