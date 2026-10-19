import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { renderApp } from '@test/frontend/support/render-app';
import { mockSession, password } from '@test/frontend/support/mock-session';

it('keeps the requested destination and login message under StrictMode', async () => {
  const api = mockSession(false);
  window.sessionStorage.setItem('inbox-point:return-path', '/ops');
  window.sessionStorage.setItem(
    'inbox-point:login-message',
    'Сессия завершилась. Войдите снова.',
  );
  const { router } = renderApp('/login');
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Вход в управление' });
  expect(screen.getByRole('alert').textContent).toContain(
    'Сессия завершилась.',
  );
  await user.type(screen.getByLabelText('Пароль'), 'wrong');
  await user.click(screen.getByRole('button', { name: 'Войти' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toBe('Неверный пароль.'),
  );
  expect(screen.getByLabelText<HTMLInputElement>('Пароль').value).toBe('');
  await user.type(screen.getByLabelText('Пароль'), password);
  await user.click(
    screen.getByLabelText('Запомнить это устройство на 30 дней'),
  );
  await user.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByRole('heading', { name: 'Состояние сервиса' });
  expect(router.state.location.pathname).toBe('/ops');
  expect(document.title).toBe('Состояние сервиса — Inbox Point');
  expect(api.commands.at(-1)?.body).toEqual({ password, rememberDevice: true });
  expect(window.sessionStorage.getItem('inbox-point:return-path')).toBeNull();
});

it('keeps one session owner while links, history and titles change', async () => {
  const api = mockSession();
  const { router } = renderApp('/manage');
  const user = userEvent.setup();
  await screen.findByText('Учебная организация');
  const initialReads = api.fetchMock.mock.calls.filter(
    ([url]) => url === '/api/admin/session',
  ).length;
  await user.click(screen.getByRole('link', { name: 'Каналы' }));
  await screen.findByRole('heading', { name: 'Каналы' });
  expect(
    screen.getByRole('link', { name: 'Каналы' }).getAttribute('aria-current'),
  ).toBe('page');
  await user.click(screen.getByRole('link', { name: 'Мониторинг' }));
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe('/setup');
  await act(() => router.navigate(1));
  expect(router.state.location.pathname).toBe('/ops');
  expect(
    api.fetchMock.mock.calls.filter(([url]) => url === '/api/admin/session'),
  ).toHaveLength(initialReads);
});

it.each(['/analytics', '/login'])(
  'clamps unsafe or unsupported login return paths from %s',
  async (path) => {
    mockSession(path === '/login');
    window.sessionStorage.setItem(
      'inbox-point:return-path',
      'https://example.invalid/',
    );
    const { router } = renderApp(path);
    if (path === '/analytics') {
      await screen.findByRole('heading', { name: 'Вход в управление' });
      const user = userEvent.setup();
      await user.type(screen.getByLabelText('Пароль'), password);
      await user.click(screen.getByRole('button', { name: 'Войти' }));
    }
    await screen.findByRole('heading', { name: 'Ответы клиентам' });
    expect(router.state.location.pathname).toBe('/manage');
  },
);

it('renders an unknown route without an authenticated shell', async () => {
  mockSession(false);
  renderApp('/unknown/path');
  await screen.findByRole('heading', { name: 'Страница не найдена' });
  expect(document.title).toBe('Страница не найдена — Inbox Point');
  expect(screen.queryByRole('navigation')).toBeNull();
});
