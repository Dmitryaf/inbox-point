import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { mockOperations } from '@test/frontend/support/mock-operations';
import { password } from '@test/frontend/support/mock-session';
import { renderApp } from '@test/frontend/support/render-app';

it.each([
  '/api/ops/status',
  '/api/ops/service-control',
  '/api/ops/inbox/requests',
  '/api/ops/inbox/requests/A/messages',
])('expires active read %s and clears protected cache', async (endpoint) => {
  const api = mockOperations(true);
  api.overrides.set(endpoint, () => Promise.resolve(response({}, 401)));
  const { queryClient } = renderApp('/ops');
  await screen.findByRole('heading', { name: 'Вход в управление' });
  await waitFor(() =>
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0),
  );
});

it('reply 401 does not replay the command on login', async () => {
  const api = mockOperations(true);
  api.overrides.set('/api/ops/inbox/requests/A/replies', () =>
    Promise.resolve(response({}, 401)),
  );
  renderApp('/ops');
  await screen.findByText('Message A');
  fireEvent.change(screen.getByLabelText('Ответ'), {
    target: { value: 'Synthetic reply' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Отправить' }));
  await screen.findByRole('heading', { name: 'Вход в управление' });
  await userEvent.type(screen.getByLabelText('Пароль'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByText('Message A');
  expect(
    api.commands.filter((item) => item.url.endsWith('/replies')),
  ).toHaveLength(1);
});

it.each([200, 401])(
  'late resolution %i cannot affect the next session',
  async (status) => {
    const api = mockOperations();
    const pending = Promise.withResolvers<FakeResponse>();
    api.overrides.set(
      '/api/ops/deliveries/delivery-1/retry',
      () => pending.promise,
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { queryClient } = renderApp('/ops');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Повторить отправку' }),
    );
    await waitFor(() => expect(api.commands).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    await screen.findByRole('heading', { name: 'Вход в управление' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    await userEvent.type(screen.getByLabelText('Пароль'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByText('Нужно проверить');
    await act(async () => {
      pending.resolve(response({}, status));
      await pending.promise;
    });
    expect(screen.queryByText('Повторная отправка началась.')).toBeNull();
    expect(
      screen.queryByRole('heading', { name: 'Вход в управление' }),
    ).toBeNull();
  },
);
