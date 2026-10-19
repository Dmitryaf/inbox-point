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
