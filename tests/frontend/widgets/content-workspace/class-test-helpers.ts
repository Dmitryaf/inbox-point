import { fireEvent, screen } from '@testing-library/react';
import { renderApp } from '@test/frontend/support/render-app';
import {
  contentFixture,
  mockContent,
} from '@test/frontend/support/mock-content';
export async function mountEditor(snapshot = contentFixture()) {
  const api = mockContent(snapshot);
  const view = renderApp('/manage');
  await screen.findByLabelText('Название организации');
  return { ...api, ...view };
}
export function openInitialGroup() {
  fireEvent.click(screen.getByRole('button', { name: /^Танец/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Старое расписание/ }));
}
export function field(
  id: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const element = document.getElementById(id);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return element;
  }
  throw new Error(`Missing field ${id}`);
}
export function change(id: string, value: string) {
  fireEvent.change(field(id), { target: { value } });
}
export const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
