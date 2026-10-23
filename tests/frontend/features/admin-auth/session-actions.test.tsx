import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import { mockSession } from '@test/frontend/support/mock-session';
import { response } from '@test/frontend/support/fake-response';

it('keeps authenticated state and cached identity after a failed logout', async () => {
  const api = mockSession();
  api.overrides.set('/api/admin/logout', () =>
    Promise.reject(new Error('private network details')),
  );
  const { router } = renderApp('/setup');
  await screen.findByText('Учебная организация');
  await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('alert').textContent).not.toContain(
    'private network details',
  );
  expect(router.state.location.pathname).toBe('/setup');
  expect(screen.getByText('Учебная организация')).toBeDefined();
});

it('cancels revoke all without a command and clears cache after confirmation', async () => {
  const api = mockSession();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const { queryClient } = renderApp('/setup');
  await screen.findByText('Учебная организация');
  const button = screen.getByRole('button', {
    name: 'Выйти на всех устройствах',
  });
  await userEvent.click(button);
  expect(api.commands).toHaveLength(0);
  confirm.mockReturnValue(true);
  await userEvent.click(button);
  await screen.findByRole('heading', { name: 'Вход в управление' });
  expect(confirm).toHaveBeenCalledWith(
    'Выйти из управления на всех устройствах?',
  );
  expect(api.commands.map((command) => command.url)).toEqual([
    '/api/admin/sessions/revoke-all',
  ]);
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

it('expires the session when protected data returns 401', async () => {
  const api = mockSession();
  api.overrides.set('/api/manage/content', () =>
    Promise.resolve(response({ message: 'Войдите, чтобы продолжить.' }, 401)),
  );
  const { queryClient } = renderApp('/ops');
  await screen.findByRole('heading', { name: 'Вход в управление' });
  expect(screen.getByRole('alert').textContent).toContain(
    'Сессия завершилась.',
  );
  expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
});

it('keeps bypass mode out of the password and logout flows', async () => {
  const api = mockSession(true, 'bypass');
  renderApp('/login');
  await screen.findByRole('heading', { name: 'Ответы клиентам' });
  expect(screen.queryByRole('button', { name: 'Выйти' })).toBeNull();
  expect(api.commands).toHaveLength(0);
});

it('shows a safe startup error and still permits login', async () => {
  const api = mockSession(false);
  api.overrides.set('/api/admin/session', () =>
    Promise.reject(new Error('sensitive diagnostic')),
  );
  renderApp('/manage');
  await screen.findByRole('heading', { name: 'Вход в управление' });
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Проверьте подключение',
    ),
  );
  expect(screen.getByRole('alert').textContent).not.toContain(
    'sensitive diagnostic',
  );
});
