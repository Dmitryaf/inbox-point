import { expect, type Page } from '@playwright/test';

export const password = 'synthetic-admin-password';
export async function login(
  page: Page,
  destination = '/manage',
  remember = false,
): Promise<void> {
  await page.goto(destination);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page
    .getByLabel('Запомнить это устройство на 30 дней')
    .setChecked(remember);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
}
