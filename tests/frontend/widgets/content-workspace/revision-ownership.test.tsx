import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { contentFixture } from '@test/frontend/support/mock-content';
import { response } from '@test/frontend/support/fake-response';
import { mountEditor, change, field } from './class-test-helpers';

it('keeps the latest selected preview and restores that revision when an earlier read arrives late', async () => {
  const initial = contentFixture();
  const api = await mountEditor(initial);
  api.overrides.set('/api/manage/content/history', () =>
    Promise.resolve(
      response({
        history: [3, 2, 1].map((revision) => ({
          revision,
          changedAt: '2026-09-02T12:00:00Z',
          sections: ['prices'],
        })),
      }),
    ),
  );
  const old = Promise.withResolvers<ReturnType<typeof response>>();
  api.overrides.set('/api/manage/content/history/1', () => old.promise);
  api.overrides.set('/api/manage/content/history/2', () =>
    Promise.resolve(
      response({
        ...initial,
        content: { ...initial.content, organizationName: 'Выбранная версия' },
      }),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'История' }));
  fireEvent.click(screen.getByRole('button', { name: 'Обновить историю' }));
  await screen.findByText(/Версия 3/);
  const buttons = screen.getAllByRole('button', { name: 'Посмотреть версию' });
  fireEvent.click(buttons[1]!);
  fireEvent.click(buttons[0]!);
  await screen.findByText('Выбранная версия', { selector: 'p' });
  await act(async () => {
    old.resolve(
      response({
        ...initial,
        content: {
          ...initial.content,
          organizationName: 'Устаревший просмотр',
        },
      }),
    );
    await old.promise;
  });
  expect(screen.queryByText('Устаревший просмотр')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Да, восстановить' }));
  await screen.findByText('Все изменения сохранены');
  expect(api.commands[0]?.body).toEqual({
    revision: 2,
    version: initial.version,
  });
});

it('ignores an old restore result after reopening the editor', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const api = await mountEditor();
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  api.overrides.set('/api/manage/content/restore', () => pending.promise);
  fireEvent.click(screen.getByRole('button', { name: 'История' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Посмотреть версию' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Да, восстановить' }),
  );
  await act(() => api.router.navigate('/setup'));
  await act(() => api.router.navigate('/manage'));
  await screen.findByLabelText('Название организации');
  change('organization-name', 'Новый черновик');
  await act(async () => {
    pending.resolve(
      response({
        ...contentFixture(),
        version: 'd'.repeat(64),
        content: {
          ...contentFixture().content,
          organizationName: 'Старое восстановление',
        },
      }),
    );
    await pending.promise;
  });
  expect(field('organization-name').value).toBe('Новый черновик');
  expect(screen.queryByText(/Предыдущая версия восстановлена/)).toBeNull();
});
