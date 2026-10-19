import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { renderApp } from '@test/react/support/render-app';
import { password } from '@test/react/support/mock-session';
import { local, mockSetup, token } from '@test/react/support/mock-setup';

it('does not repeat a pending connect, retains form on failure and retries only explicitly', async () => {
  const api = mockSetup({
    ...local,
    vk: { connected: false, source: 'none', locked: false },
  });
  const pending = Promise.withResolvers<FakeResponse>();
  let count = 0;
  api.overrides.set('/api/setup/vk/connect', () => {
    count++;
    return pending.promise;
  });
  renderApp('/setup');
  fireEvent.click(await screen.findByRole('button', { name: 'Подключить VK' }));
  fireEvent.change(screen.getByLabelText('Ссылка на страницу сообщества VK'), {
    target: { value: 'https://vk.com/synthetic' },
  });
  fireEvent.change(
    screen.getByLabelText('Ключ с правами управления и сообщений'),
    { target: { value: token } },
  );
  const button = screen.getByRole('button', { name: 'Подключить VK' });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(count).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
  fireEvent.click(screen.getByRole('button', { name: 'Подключить VK' }));
  expect(
    screen.getByLabelText<HTMLInputElement>(
      'Ключ с правами управления и сообщений',
    ).value,
  ).toBe(token);
  await act(async () => {
    pending.resolve(response({ message: 'Проверьте права сообщества.' }, 400));
    await pending.promise;
  });
  await screen.findByRole('alert');
  expect(count).toBe(1);
  expect(
    screen.getByLabelText<HTMLInputElement>('Ссылка на страницу сообщества VK')
      .value,
  ).toBe('https://vk.com/synthetic');
  api.overrides.set('/api/setup/vk/connect', () => {
    count++;
    return Promise.resolve(response({ connected: true }));
  });
  fireEvent.click(screen.getByRole('button', { name: 'Подключить VK' }));
  await screen.findByText('Подключение активно.');
  expect(count).toBe(2);
});

it.each([200, 401])(
  'late disconnect %i cannot mutate or expire the next logged-in session',
  async (status) => {
    const api = mockSetup({ ...local, vk: local });
    const pending = Promise.withResolvers<FakeResponse>();
    let count = 0;
    api.overrides.set('/api/setup/vk', () => {
      count++;
      return pending.promise;
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { queryClient } = renderApp('/setup');
    const buttons = await screen.findAllByRole('button', { name: 'Сведения' });
    fireEvent.click(buttons[1]!);
    const button = screen.getByRole('button', { name: 'Отключить VK' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(count).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }));
    await screen.findByRole('heading', { name: 'Вход в управление' });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    await userEvent.type(screen.getByLabelText('Пароль'), password);
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() =>
      expect(screen.getAllByText('Подключён')).toHaveLength(2),
    );
    await act(async () => {
      pending.resolve(response({ connected: false }, status));
      await pending.promise;
    });
    expect(screen.getAllByText('Подключён')).toHaveLength(2);
    expect(
      screen.queryByRole('heading', { name: 'Вход в управление' }),
    ).toBeNull();
    expect(count).toBe(1);
  },
);
