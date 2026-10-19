import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { contentFixture } from '@test/react/support/mock-content';
import { response } from '@test/frontend/support/fake-response';
import {
  mountEditor,
  openInitialGroup,
  field,
  change,
  save,
} from './class-test-helpers';

async function review() {
  fireEvent.click(screen.getByText('История', { selector: 'summary' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Посмотреть версию' }),
  );
  await screen.findByRole('button', { name: 'Да, восстановить' });
}

it('reports saved when concurrent input already matches the restored document', async () => {
  const api = await mountEditor();
  openInitialGroup();
  change('group-name-group', 'Другая версия');
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  api.overrides.set('/api/manage/content/restore', () => pending.promise);
  await review();
  fireEvent.click(screen.getByRole('button', { name: 'Да, восстановить' }));
  change('group-name-group', 'Старое расписание');
  await act(async () => {
    pending.resolve(response({ ...contentFixture(), version: 'd'.repeat(64) }));
    await pending.promise;
  });
  await screen.findByText('Все изменения сохранены');
  expect(
    screen.queryByText(
      'Предыдущая версия восстановлена. Ваши новые правки остались в редакторе и ещё не сохранены.',
    ),
  ).toBeNull();
});

it('requires preview and explicit confirmation, restores the full revision, and does not repeat it on history failure', async () => {
  const api = await mountEditor();
  openInitialGroup();
  change('group-time-group-0', 'Вторник, 20:00');
  await review();
  expect(api.commands).toHaveLength(0);
  expect(
    screen.getByText('Несохранённые изменения будут потеряны.'),
  ).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(api.commands).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Посмотреть версию' }));
  await screen.findByRole('button', { name: 'Да, восстановить' });
  api.overrides.set('/api/manage/content/history', () =>
    Promise.resolve(response({}, 503)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Да, восстановить' }));
  await screen.findByText(
    'Версия восстановлена, но историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.',
  );
  expect(field('group-time-group-0').value).toBe('Понедельник, 19:00');
  expect(screen.getByText('Все изменения сохранены')).toBeDefined();
  expect(api.commands).toEqual([
    {
      url: '/api/manage/content/restore',
      body: { revision: 1, version: contentFixture().version },
    },
  ]);
  expect(screen.queryByRole('button', { name: 'Да, восстановить' })).toBeNull();
  api.overrides.set('/api/manage/content/history', () =>
    Promise.resolve(response({ history: [] })),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Обновить историю' }));
  await screen.findByText('Изменений пока нет.');
  expect(api.commands).toHaveLength(1);
});
it('keeps input made during restore dirty and uses the restored version for the next save', async () => {
  const api = await mountEditor();
  openInitialGroup();
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  api.overrides.set('/api/manage/content/restore', () => pending.promise);
  await review();
  const restore = screen.getByRole('button', { name: 'Да, восстановить' });
  fireEvent.click(restore);
  fireEvent.click(restore);
  change('group-name-group', 'Новая несохранённая правка');
  save();
  expect(api.commands).toHaveLength(1);
  await act(async () => {
    pending.resolve(response({ ...contentFixture(), version: 'd'.repeat(64) }));
    await pending.promise;
  });
  await screen.findByText(
    'Предыдущая версия восстановлена. Ваши новые правки остались в редакторе и ещё не сохранены.',
  );
  expect(field('group-name-group').value).toBe('Новая несохранённая правка');
  expect(screen.getByText('Есть несохранённые изменения')).toBeDefined();
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.version).toBe('d'.repeat(64));
});
it.each([409, 500])(
  'retains edits and version when restoring fails with %s',
  async (status) => {
    const api = await mountEditor();
    change('organization-name', 'Мой черновик');
    api.overrides.set('/api/manage/content/restore', () =>
      Promise.resolve(
        response({ message: 'Не удалось восстановить информацию.' }, status),
      ),
    );
    await review();
    fireEvent.click(screen.getByRole('button', { name: 'Да, восстановить' }));
    await screen.findByText('Не удалось восстановить информацию.');
    expect(field('organization-name').value).toBe('Мой черновик');
    save();
    await screen.findByText('Все изменения сохранены');
    expect(api.submissions[0]?.version).toBe(contentFixture().version);
  },
);
it('does not show a late version after preview cancellation', async () => {
  const api = await mountEditor();
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  api.overrides.set('/api/manage/content/history/1', () => pending.promise);
  fireEvent.click(screen.getByText('История', { selector: 'summary' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Посмотреть версию' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  await act(async () => {
    pending.resolve(response(contentFixture()));
    await pending.promise;
  });
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Да, восстановить' }),
    ).toBeNull(),
  );
  expect(api.commands).toHaveLength(0);
});
