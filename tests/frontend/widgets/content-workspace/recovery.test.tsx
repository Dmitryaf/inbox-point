import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import {
  contentFixture,
  mockContent,
} from '@test/frontend/support/mock-content';
import { password } from '@test/frontend/support/mock-session';
import { response } from '@test/frontend/support/fake-response';

it.each(['save', 'preview'])(
  'recovers draft and original version after %s returns 401 under StrictMode',
  async (action) => {
    const api = mockContent();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const original = api.overrides.get('/api/manage/content')!;
    let expired = false;
    api.overrides.set('/api/manage/content', (init) => {
      if (init?.method === 'POST' && !expired) {
        expired = true;
        return Promise.resolve(
          response({ message: 'Сессия завершилась.' }, 401),
        );
      }
      return expired && init?.method !== 'POST'
        ? Promise.resolve(
            response({ ...contentFixture(), version: 'd'.repeat(64) }),
          )
        : original(init);
    });
    api.overrides.set('/api/manage/content/history/1', () => {
      expired = true;
      return Promise.resolve(response({}, 401));
    });
    renderApp('/manage');
    await screen.findByLabelText('Название организации');
    fireEvent.change(screen.getByLabelText('Название организации'), {
      target: { value: 'Несохранённый черновик' },
    });
    if (action === 'save') {
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'История' }));
      await userEvent.click(
        await screen.findByRole('button', { name: 'Посмотреть версию' }),
      );
    }
    await screen.findByRole('heading', { name: 'Вход в управление' });
    expect(confirm).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('inbox-point:content-draft')).toContain(
      'Несохранённый черновик',
    );
    await userEvent.type(screen.getByLabelText('Пароль'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByText('Несохранённый черновик восстановлен.');
    expect(
      screen.getByLabelText<HTMLInputElement>('Название организации').value,
    ).toBe('Несохранённый черновик');
    expect(screen.getByText('Есть несохранённые изменения')).toBeDefined();
    expect(sessionStorage.getItem('inbox-point:content-draft')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Все изменения сохранены');
    expect(api.submissions[0]?.version).toBe(contentFixture().version);
  },
);

it('does not consume recovery when the post-login content load fails', async () => {
  const api = mockContent();
  const original = api.overrides.get('/api/manage/content')!;
  renderApp('/manage');
  await screen.findByLabelText('Название организации');
  fireEvent.change(screen.getByLabelText('Название организации'), {
    target: { value: 'Черновик' },
  });
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(response({}, 401)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await screen.findByLabelText('Пароль');
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(response({}, 503)),
  );
  await userEvent.type(screen.getByLabelText('Пароль'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByText('Редактор не открыт. Повторите загрузку.');
  expect(sessionStorage.getItem('inbox-point:content-draft')).toContain(
    'Черновик',
  );
  api.overrides.set('/api/manage/content', original);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  await screen.findByText('Несохранённый черновик восстановлен.');
  await waitFor(() =>
    expect(sessionStorage.getItem('inbox-point:content-draft')).toBeNull(),
  );
});
