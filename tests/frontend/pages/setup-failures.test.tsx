import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import { mockSetup, local, token } from '@test/frontend/support/mock-setup';

it('status read fails visibly, retries explicitly and never connects on mount/focus', async () => {
  const api = mockSetup();
  let count = 0;
  api.overrides.set('/api/setup/status', () => {
    count++;
    return Promise.resolve(response({ message: 'Повторите проверку.' }, 503));
  });
  renderApp('/setup');
  await screen.findByText('Повторите проверку.');
  const initialCount = count;
  fireEvent(window, new Event('focus'));
  expect(count).toBe(initialCount);
  fireEvent.click(
    screen.getByRole('button', { name: 'Повторить проверку подключений' }),
  );
  await waitFor(() => expect(count).toBe(initialCount + 1));
  expect(api.commands).toHaveLength(0);
  expect(api.effects).toHaveLength(0);
});

it.each(['status', 'discover', 'connect', 'disconnect'])(
  'expires the active session on %s 401 without replaying a command',
  async (path) => {
    const api = mockSetup(
      path === 'disconnect' ? { ...local, vk: local } : undefined,
    );
    const endpoint =
      path === 'status'
        ? '/api/setup/status'
        : path === 'discover'
          ? '/api/setup/telegram/discover'
          : path === 'connect'
            ? '/api/setup/telegram/connect'
            : '/api/setup/vk';
    api.overrides.set(endpoint, () => Promise.resolve(response({}, 401)));
    renderApp('/setup');
    if (path === 'disconnect') {
      viConfirm();
      const buttons = await screen.findAllByRole('button', {
        name: 'Сведения',
      });
      fireEvent.click(buttons[1]!);
      fireEvent.click(screen.getByRole('button', { name: 'Отключить VK' }));
    } else if (path !== 'status') {
      fireEvent.click(
        await screen.findByRole('button', { name: 'Подключить Telegram' }),
      );
      fireEvent.change(screen.getByLabelText(/Токен бота/), {
        target: { value: token },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Проверить токен и найти группу' }),
      );
      if (path === 'connect') {
        fireEvent.click(await screen.findByLabelText('Группа сотрудников'));
        fireEvent.click(
          screen.getByRole('button', { name: 'Подключить Telegram' }),
        );
      }
    }
    await screen.findByRole('heading', { name: 'Вход в управление' });
    expect(sessionStorage.getItem('telegram-token')).toBeNull();
    expect(api.effects).toHaveLength(0);
  },
);

it.each([200, 401])(
  'a command response %i after closing the form cannot own a new form/session',
  async (status) => {
    const api = mockSetup();
    const pending = Promise.withResolvers<FakeResponse>();
    api.overrides.set('/api/setup/telegram/discover', () => pending.promise);
    renderApp('/setup');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Подключить Telegram' }),
    );
    fireEvent.change(screen.getByLabelText(/Токен бота/), {
      target: { value: token },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Проверить токен и найти группу' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Подключить Telegram' }),
    );
    await act(async () => {
      await Promise.resolve();
      pending.resolve(
        response(
          { chats: [{ id: -1, isForum: true, title: 'Old group' }] },
          status,
        ),
      );
    });
    expect(screen.queryByText('Old group')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Токен бота/).value).toBe(
      '',
    );
    expect(
      screen.queryByRole('heading', { name: 'Вход в управление' }),
    ).toBeNull();
  },
);

function viConfirm() {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
}
