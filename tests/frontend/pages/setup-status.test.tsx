import { act, fireEvent, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import {
  local,
  mockSetup,
  none,
  token,
} from '@test/frontend/support/mock-setup';

it('shows server-managed and unavailable states without mutable forms or commands', async () => {
  const api = mockSetup({
    ...local,
    source: 'environment',
    vk: { ...none, locked: true },
  });
  renderApp('/setup');
  fireEvent.click(await screen.findByRole('button', { name: 'Сведения' }));
  fireEvent.click(screen.getByRole('button', { name: 'Подключить VK' }));
  expect(screen.getByText('Управляется на сервере.')).toBeDefined();
  expect(screen.getByText(/VK подключён при установке/)).toBeDefined();
  expect(
    screen.queryByRole('button', { name: 'Отключить Telegram' }),
  ).toBeNull();
  expect(
    screen.queryByLabelText('Ключ с правами управления и сообщений'),
  ).toBeNull();
  expect(api.effects).toHaveLength(0);
});

it('does not accept discovery for an edited token', async () => {
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
  fireEvent.change(screen.getByLabelText(/Токен бота/), {
    target: { value: `${token}-new` },
  });
  await act(async () => {
    await Promise.resolve();
    pending.resolve(
      response({ chats: [{ id: -1, title: 'Old group', isForum: true }] }),
    );
  });
  expect(screen.queryByLabelText('Old group')).toBeNull();
});
