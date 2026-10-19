import { fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { local, mockSetup, token } from '@test/react/support/mock-setup';

it.each([200, 400])(
  'empty/failed discovery %i explains recovery and preserves the token for explicit retry',
  async (status) => {
    const api = mockSetup();
    api.overrides.set('/api/setup/telegram/discover', () =>
      Promise.resolve(
        response(
          status === 200
            ? { chats: [] }
            : { message: 'Проверьте токен и группу.' },
          status,
        ),
      ),
    );
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
    if (status === 200) {
      await screen.findByText(/Группа не найдена/);
    } else {
      expect((await screen.findByRole('alert')).textContent).toBe(
        'Проверьте токен и группу.',
      );
    }
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Токен бота/).value).toBe(
      token,
    );
    api.overrides.set('/api/setup/telegram/discover', () =>
      Promise.resolve(
        response({
          chats: [{ id: -1, isForum: true, title: 'Найденная группа' }],
        }),
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Проверить токен и найти группу' }),
    );
    await screen.findByLabelText('Найденная группа');
    expect(api.effects).toHaveLength(0);
  },
);

it('neither server-managed channel exposes a disconnect action', async () => {
  mockSetup({
    ...local,
    source: 'environment',
    vk: { ...local, source: 'environment' },
  });
  renderApp('/setup');
  const buttons = await screen.findAllByRole('button', { name: 'Сведения' });
  for (const button of buttons) {
    fireEvent.click(button);
  }
  expect(screen.getAllByText('Управляется на сервере.')).toHaveLength(2);
  expect(screen.queryByRole('button', { name: /Отключить/ })).toBeNull();
});
