import { editorView } from './navigation.js';
import { expect, type Page } from '@playwright/test';
import type {
  ClientInformationContent,
  ScheduleItem,
} from '@/core/application/client-information.js';
export const contentBase = 'http://127.0.0.1:4191';
export interface ContentSnapshot {
  content: Omit<ClientInformationContent, 'schedule'> & {
    schedule: string;
    scheduleItems: ScheduleItem[];
  };
  version: string;
}
export async function readContent(page: Page): Promise<ContentSnapshot> {
  return (await (
    await page.request.get(`${contentBase}/api/manage/content`)
  ).json()) as ContentSnapshot;
}
export async function writeContent(
  page: Page,
  snapshot: ContentSnapshot,
): Promise<void> {
  expect(
    (
      await page.request.post(`${contentBase}/api/manage/content`, {
        headers: { origin: contentBase },
        data: snapshot,
      })
    ).status(),
  ).toBe(200);
}
export async function saveEditor(page: Page): Promise<void> {
  const result = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/manage/content') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await result).status()).toBe(200);
  await expect(
    page.getByText('Все изменения сохранены', { exact: true }),
  ).toBeVisible();
}
export async function openGroup(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Танец/ }).click();
  await page.getByRole('button', { name: /^Начинающие/ }).click();
}
export async function currentRevision(page: Page): Promise<number> {
  const result = (await (
    await page.request.get(`${contentBase}/api/manage/content/history`)
  ).json()) as { history: { revision: number }[] };
  return result.history[0]!.revision;
}
export async function reviewRevision(
  page: Page,
  revision: number,
): Promise<void> {
  await editorView(page, 'history');
  const history = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', {
        name: 'Предыдущие версии',
        exact: true,
      }),
    })
    .last();
  await history
    .locator(':scope > ol > li')
    .filter({ hasText: new RegExp(`Версия ${revision}(?!\\d)`) })
    .getByRole('button', { name: 'Посмотреть версию' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Да, восстановить' }),
  ).toBeEnabled();
}
