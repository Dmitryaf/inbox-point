import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { expect, it } from 'vitest';
import { renderApp } from '@test/react/support/render-app';
import { contentFixture, mockContent } from '@test/react/support/mock-content';
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

it.each([500, 409])(
  'keeps the draft and original version after save status %s',
  async (status) => {
    const api = mockContent();
    const original = api.overrides.get('/api/manage/content')!;
    api.overrides.set('/api/manage/content', (init) =>
      init?.method === 'POST'
        ? Promise.resolve(
            response(
              {
                message:
                  status === 409
                    ? 'Информация уже изменена. Обновите страницу.'
                    : 'Не удалось сохранить информацию.',
              },
              status,
            ),
          )
        : original(init),
    );
    await openEditor();
    changeName('Черновик');
    save();
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Ваши изменения остались на этой странице.',
      ),
    );
    expect(
      screen.getByLabelText<HTMLInputElement>('Название организации').value,
    ).toBe('Черновик');
    expect(screen.getByText('Есть несохранённые изменения')).toBeDefined();
    api.overrides.set('/api/manage/content', original);
    save();
    await screen.findByText('Все изменения сохранены');
    expect(api.submissions[0]?.version).toBe(contentFixture().version);
  },
);

it('keeps later input dirty, submits once and uses the acknowledged version for the next save', async () => {
  const api = mockContent();
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  const original = api.overrides.get('/api/manage/content')!;
  api.overrides.set('/api/manage/content', (init) =>
    init?.method === 'POST' ? pending.promise : original(init),
  );
  await openEditor();
  changeName('Первое изменение');
  save();
  save();
  changeName('Второе изменение');
  expect(
    api.commands.filter((command) => command.url === '/api/manage/content'),
  ).toHaveLength(1);
  await act(async () => {
    pending.resolve(
      response({
        ...contentFixture(),
        version: 'c'.repeat(64),
        content: {
          ...contentFixture().content,
          organizationName: 'Первое изменение',
        },
      }),
    );
    await pending.promise;
  });
  await screen.findByText('Есть несохранённые изменения');
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Второе изменение');
  api.overrides.set('/api/manage/content', original);
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.version).toBe('c'.repeat(64));
});

it('does not repeat a successful write when history refresh fails', async () => {
  const api = mockContent();
  await openEditor();
  await waitFor(() =>
    expect(screen.queryByText('Обновляем историю…')).toBeNull(),
  );
  api.overrides.set('/api/manage/content/history', () =>
    Promise.resolve(response({ message: 'История недоступна.' }, 503)),
  );
  changeName('Сохранено');
  save();
  await screen.findByText(/Информация сохранена, но историю изменений/);
  expect(api.submissions).toHaveLength(1);
  expect(screen.getByText('Все изменения сохранены')).toBeDefined();
  api.overrides.set('/api/manage/content/history', () =>
    Promise.resolve(response({ history: [] })),
  );
  fireEvent.click(screen.getByText('История', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Обновить историю' }));
  await screen.findByText('Изменений пока нет.');
  expect(api.submissions).toHaveLength(1);
});
