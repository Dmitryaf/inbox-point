// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelegramSetup as SetupPage } from '../../frontend/src/SetupPage';

const token = 'synthetic-test-token-0000000000';
const chat = { id: -100001, title: 'Учебная группа', isForum: true };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Telegram setup', () => {
  it('discovers a group and sends the selected destination, clearing the token after confirmation', async () => {
    const connecting = Promise.withResolvers<Response>();
    const fetchMock = vi
      .fn<(path: string, options?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ connected: false }))
      .mockResolvedValueOnce(json({ chats: [chat] }))
      .mockImplementationOnce(() => connecting.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<SetupPage />);
    await screen.findByText('Выполните три шага выше.');
    fireEvent.change(screen.getByLabelText('Токен от @BotFather'), {
      target: { value: ` ${token} ` },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Найти группы' }));
    fireEvent.click(await screen.findByRole('radio', { name: chat.title }));
    fireEvent.click(screen.getByRole('button', { name: 'Подключить' }));
    await screen.findByText('Подключаем…');
    expect(
      screen.getByLabelText<HTMLInputElement>('Токен от @BotFather').value,
    ).toBe(` ${token} `);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ botToken: token }),
    );
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({ botToken: token, operatorChatId: chat.id }),
    );
    connecting.resolve(json({ connected: true }));
    await screen.findByText('Telegram подключён. Настройка сохранена.');
    expect((document.getElementById('token') as HTMLInputElement).value).toBe(
      '',
    );
    expect(document.getElementById('wizard')?.hidden).toBe(true);
  });

  it('preserves the token after a failed connection and permits retry without losing the group', async () => {
    const fetchMock = vi
      .fn<(path: string, options?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(json({ connected: false }))
      .mockResolvedValueOnce(json({ chats: [chat] }))
      .mockResolvedValueOnce(
        json({ message: 'Разрешите боту управлять темами группы.' }, 400),
      )
      .mockResolvedValueOnce(json({ connected: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(<SetupPage />);
    await screen.findByText('Выполните три шага выше.');
    fireEvent.change(screen.getByLabelText('Токен от @BotFather'), {
      target: { value: token },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Найти группы' }));
    fireEvent.click(await screen.findByRole('radio', { name: chat.title }));
    fireEvent.click(screen.getByRole('button', { name: 'Подключить' }));
    await screen.findByText('Разрешите боту управлять темами группы.');
    expect(
      screen.getByLabelText<HTMLInputElement>('Токен от @BotFather').value,
    ).toBe(token);
    fireEvent.click(screen.getByRole('button', { name: 'Подключить' }));
    await screen.findByText('Telegram подключён. Настройка сохранена.');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('renders provider titles as text and performs no connection without a selected group', async () => {
    const fetchMock = vi
      .fn<(path: string) => Promise<Response>>()
      .mockResolvedValueOnce(json({ connected: false }))
      .mockResolvedValueOnce(
        json({ chats: [{ ...chat, title: '<img src=x onerror=alert(1)>' }] }),
      );
    vi.stubGlobal('fetch', fetchMock);
    render(<SetupPage />);
    await screen.findByText('Выполните три шага выше.');
    fireEvent.click(screen.getByRole('button', { name: 'Найти группы' }));
    await screen.findByRole('radio');
    expect(document.querySelector('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Подключить' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status').textContent).toBe('Выберите группу.');
  });
});
