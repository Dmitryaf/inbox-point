import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { password } from '@test/frontend/support/mock-session';
import { response } from '@test/frontend/support/fake-response';
import { contentFixture } from '@test/frontend/support/mock-content';
import { mountEditor, change, field, save } from './class-test-helpers';

it('recovers the whole dirty document and original version after restore returns 401 without repeating restore', async () => {
  const api = await mountEditor();
  change('organization-name', 'Черновик до восстановления');
  api.overrides.set('/api/manage/content/restore', () =>
    Promise.resolve(response({}, 401)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'История' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Посмотреть версию' }),
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Да, восстановить' }),
  );
  await screen.findByLabelText('Пароль');
  await userEvent.type(screen.getByLabelText('Пароль'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByText('Несохранённый черновик восстановлен.');
  expect(field('organization-name').value).toBe('Черновик до восстановления');
  expect(
    api.commands.filter((command) => command.url.endsWith('/restore')),
  ).toHaveLength(1);
  save();
  await screen.findByText('Все изменения сохранены');
  expect(api.submissions[0]?.version).toBe(contentFixture().version);
  expect(api.submissions[0]?.content.groups).toEqual(
    contentFixture().content.groups,
  );
});

it('refuses an incompatible older server without exposing an empty editor', async () => {
  const initial = contentFixture();
  delete initial.content.scheduleItems;
  const api = await import('@test/frontend/support/mock-content');
  api.mockContent(initial);
  const app = await import('@test/frontend/support/render-app');
  app.renderApp('/manage');
  await screen.findByText('Редактор не открыт. Повторите загрузку.');
  expect(screen.getByRole('alert').textContent).toContain(
    'Сервер и страница используют разные версии. Обновите страницу.',
  );
  expect(screen.queryByLabelText('Название организации')).toBeNull();
});
