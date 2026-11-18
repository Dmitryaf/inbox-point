import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import {
  contentFixture,
  mockContent,
} from '@test/frontend/support/mock-content';
import { response } from '@test/frontend/support/fake-response';

async function openEditor() {
  const view = renderApp('/manage');
  await screen.findByLabelText('Название организации');
  return view;
}
function changeName(value: string) {
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value },
  });
}
const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

it('edits and saves the price reached through the customer menu', async () => {
  const initial = contentFixture();
  initial.content.visibleSections?.push('address');
  const api = mockContent(initial);
  await openEditor();
  const click = (name: string) =>
    fireEvent.click(screen.getByRole('button', { name }));
  click('Предпросмотр');
  click('Цены');
  const price = screen.getByRole('textbox', { name: 'Текст ответа «Цены»' });
  fireEvent.change(price, { target: { value: 'Пробное занятие — 750 ₽.' } });
  expect(screen.getByLabelText('Пример переписки').textContent).toContain(
    '750 ₽',
  );
  click('Меню');
  click('Адрес');
  click('Меню');
  click('Цены');
  expect(
    screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Текст ответа «Цены»',
    }).value,
  ).toContain('750 ₽');
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.content.prices).toBe('Пробное занятие — 750 ₽.');
});

it('writes the whole original document and reads it again after reopening', async () => {
  const api = mockContent();
  const { router } = await openEditor();
  changeName('Новое название');
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions).toHaveLength(1);
  expect(api.submissions[0]).toEqual({
    version: contentFixture().version,
    content: {
      ...contentFixture().content,
      organizationName: 'Новое название',
    },
  });
  await act(() => router.navigate('/setup'));
  await act(() => router.navigate('/manage'));
  expect(
    (await screen.findByLabelText<HTMLInputElement>('Название организации'))
      .value,
  ).toBe('Новое название');
});

it('opens a group editor directly from the group answer preview', async () => {
  mockContent();
  await openEditor();
  for (const name of [
    'Предпросмотр',
    'Расписание',
    'Танец',
    'Старое расписание',
    'Изменить группу',
  ]) {
    fireEvent.click(screen.getByRole('button', { name }));
  }
  const heading = screen.getByRole('heading', {
    name: 'Танец → Старое расписание',
  });
  expect(document.activeElement).toBe(heading);
});

it('keeps initial failure distinct from empty content and retries', async () => {
  const api = mockContent();
  const original = api.overrides.get('/api/manage/content')!;
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(
      response({ message: 'Не удалось загрузить информацию.' }, 503),
    ),
  );
  renderApp('/manage');
  await screen.findByText('Редактор не открыт. Повторите загрузку.');
  expect(screen.queryByLabelText('Название организации')).toBeNull();
  api.overrides.set('/api/manage/content', original);
  await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await screen.findByLabelText('Название организации');
});
