import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { response } from '@test/frontend/support/fake-response';
import { renderApp } from '@test/frontend/support/render-app';
import { local, mockSetup, token } from '@test/frontend/support/mock-setup';

it('requires Telegram before VK and clears a closed token form', async () => {
  const api = mockSetup();
  renderApp('/setup');
  await screen.findByRole('button', { name: 'Сначала Telegram' });
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Сначала Telegram' })
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
  fireEvent.change(
    screen.getByLabelText('Токен бота — строка-пароль от @BotFather'),
    { target: { value: token } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
  expect(
    screen.queryByLabelText('Токен бота — строка-пароль от @BotFather'),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
  expect(
    screen.getByLabelText<HTMLInputElement>(
      'Токен бота — строка-пароль от @BotFather',
    ).value,
  ).toBe('');
  expect(api.effects).toEqual([]);
  expect(api.commands).toEqual([]);
});

it('discovers groups, connects each channel once, clears secrets and rereads server state on return', async () => {
  const api = mockSetup();
  renderApp('/setup');
  fireEvent.click(
    await screen.findByRole('button', { name: 'Подключить Telegram' }),
  );
  fireEvent.change(screen.getByLabelText(/Токен бота/), {
    target: { value: ` ${token} ` },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Проверить токен и найти группу' }),
  );
  fireEvent.click(await screen.findByLabelText('Группа сотрудников'));
  expect(screen.getByLabelText('Без тем — включите темы')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Подключить Telegram' }));
  await screen.findByText('Подключение активно.');
  fireEvent.click(screen.getByRole('button', { name: 'Подключить VK' }));
  fireEvent.change(screen.getByLabelText('Ссылка на страницу сообщества VK'), {
    target: { value: ' https://vk.com/synthetic ' },
  });
  fireEvent.change(
    screen.getByLabelText('Ключ с правами управления и сообщений'),
    { target: { value: ` ${token} ` } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Подключить VK' }));
  await waitFor(() =>
    expect(screen.getAllByText('Подключение активно.')).toHaveLength(2),
  );
  expect(api.effects).toEqual(['telegram:connect', 'vk:connect']);
  expect(api.commands.map((item) => item.body)).toEqual([
    { botToken: token },
    { botToken: token, operatorChatId: -1001 },
    { accessToken: token, community: 'https://vk.com/synthetic' },
  ]);
  expect(document.body.textContent).not.toContain(token);
  expect(sessionStorage.length).toBe(0);
  fireEvent.click(screen.getByRole('link', { name: 'Мониторинг' }));
  fireEvent.click(screen.getByRole('link', { name: 'Каналы' }));
  await waitFor(() => expect(screen.getAllByText('Подключён')).toHaveLength(2));
});

it('keeps connections on failed/cancelled disconnect and enforces VK → Telegram order', async () => {
  const api = mockSetup({ ...local, vk: local });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderApp('/setup');
  const cards = await screen.findAllByRole('region');
  expect(cards).toHaveLength(2);
  for (const card of cards) {
    fireEvent.click(within(card).getByRole('button', { name: 'Сведения' }));
  }
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Отключить Telegram',
    }).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Отключить VK' }));
  expect(api.effects).toHaveLength(0);
  confirm.mockReturnValue(true);
  api.overrides.set('/api/setup/vk', () =>
    Promise.resolve(response({ message: 'Не удалось отключить VK.' }, 500)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Отключить VK' }));
  await screen.findByText('Не удалось отключить VK.');
  expect(screen.getAllByText('Подключён')).toHaveLength(2);
  expect(
    screen.getByRole<HTMLButtonElement>('button', {
      name: 'Отключить Telegram',
    }).disabled,
  ).toBe(true);
  api.overrides.set('/api/setup/vk', () =>
    Promise.resolve(response({ connected: false })),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Отключить VK' }));
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLButtonElement>('button', {
        name: 'Отключить Telegram',
      }).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Отключить Telegram' }));
  await waitFor(() =>
    expect(screen.getAllByText('Не подключён')).toHaveLength(2),
  );
  expect(
    confirm.mock.calls.every(([message]) =>
      String(message).includes('История обращений сохранится.'),
    ),
  ).toBe(true);
});
