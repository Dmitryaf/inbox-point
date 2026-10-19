import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { loadContent } from '@frontend-common/entities/content/api/content-api';
import { renderApp } from '@test/react/support/render-app';
import { contentFixture, mockContent } from '@test/react/support/mock-content';
import { response } from '@test/frontend/support/fake-response';

it('does not replace dirty input after a server cache refresh', async () => {
  const api = mockContent();
  const { queryClient } = renderApp('/manage');
  await screen.findByLabelText('Название организации');
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value: 'Мой черновик' },
  });
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(
      response({
        ...contentFixture(),
        content: {
          ...contentFixture().content,
          organizationName: 'Серверное изменение',
        },
      }),
    ),
  );
  const query = queryClient
    .getQueryCache()
    .getAll()
    .find((item) => item.queryKey.includes('content'))!;
  await act(() =>
    queryClient.fetchQuery({
      queryKey: query.queryKey,
      queryFn: ({ signal }) => loadContent(signal),
      staleTime: 0,
    }),
  );
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Мой черновик');
  expect(screen.getByText('Есть несохранённые изменения')).toBeDefined();
});
it('ignores a save response after leaving and reopening the editor', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const api = mockContent();
  const { router } = renderApp('/manage');
  await screen.findByLabelText('Название организации');
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  const original = api.overrides.get('/api/manage/content')!;
  api.overrides.set('/api/manage/content', (init) =>
    init?.method === 'POST' ? pending.promise : original(init),
  );
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value: 'Старая отправка' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await act(() => router.navigate('/setup'));
  await act(() => router.navigate('/manage'));
  await screen.findByLabelText('Название организации');
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value: 'Новый черновик' },
  });
  await act(async () => {
    pending.resolve(
      response({
        ...contentFixture(),
        content: {
          ...contentFixture().content,
          organizationName: 'Старая отправка',
        },
      }),
    );
    await pending.promise;
  });
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Новый черновик');
  expect(screen.getByText('Есть несохранённые изменения')).toBeDefined();
});
it('retains visible edits if browser storage cannot preserve the recovery', async () => {
  const api = mockContent();
  renderApp('/manage');
  await screen.findByLabelText('Название организации');
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value: 'Скопировать этот текст' },
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage unavailable');
  });
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(response({}, 401)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await screen.findByText(/Не удалось сохранить черновик для повторного входа/);
  expect(
    screen.getByLabelText<HTMLInputElement>('Название организации').value,
  ).toBe('Скопировать этот текст');
  expect(screen.queryByLabelText('Пароль')).toBeNull();
});
