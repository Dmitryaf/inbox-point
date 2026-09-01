import { useEffect, useState } from 'react';

interface OperatorChat {
  id: number;
  title: string;
  isForum: boolean;
}

async function request<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined
      ? {}
      : {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
    ...(signal ? { signal } : {}),
  });
  const value = (await response.json()) as T & { message?: unknown };
  if (!response.ok)
    throw new Error(
      typeof value.message === 'string'
        ? value.message
        : 'Не удалось выполнить действие.',
    );
  return value;
}

export function SetupPage() {
  const [connected, setConnected] = useState<boolean | undefined>();
  const [token, setToken] = useState('');
  const [chats, setChats] = useState<OperatorChat[]>([]);
  const [selected, setSelected] = useState<number>();
  const [message, setMessage] = useState('Проверяем состояние…');

  useEffect(() => {
    const controller = new AbortController();
    void request<{ connected: boolean }>(
      '/api/setup/status',
      undefined,
      controller.signal,
    ).then(
      (status) => {
        if (controller.signal.aborted) return;
        setConnected(status.connected);
        setMessage(
          status.connected ? 'Telegram подключён.' : 'Выполните три шага выше.',
        );
      },
      () => {
        if (!controller.signal.aborted)
          setMessage('Не удалось проверить подключение. Обновите страницу.');
      },
    );
    return () => controller.abort();
  }, []);

  async function discover(): Promise<void> {
    setMessage('Ищем группы…');
    try {
      const result = await request<{ chats: OperatorChat[] }>(
        '/api/setup/telegram/discover',
        { botToken: token.trim() },
      );
      setChats(result.chats);
      setSelected(undefined);
      setMessage(
        result.chats.length
          ? 'Выберите группу.'
          : 'Напишите в группе сообщение и повторите поиск.',
      );
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось найти группы. Повторите поиск.',
      );
    }
  }

  async function connect(): Promise<void> {
    if (selected === undefined) {
      setMessage('Выберите группу.');
      return;
    }
    setMessage('Подключаем…');
    try {
      await request('/api/setup/telegram/connect', {
        botToken: token.trim(),
        operatorChatId: selected,
      });
      setToken('');
      setConnected(true);
      setMessage('Telegram подключён. Настройка сохранена.');
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось подключиться. Повторите действие.',
      );
    }
  }

  return (
    <main>
      <h1>Подключение Telegram</h1>
      <section id="wizard" hidden={connected !== false}>
        <ol>
          <li>Создайте закрытую группу и включите темы.</li>
          <li>Добавьте бота администратором с правом управлять темами.</li>
          <li>Напишите в группе любое сообщение.</li>
        </ol>
        <label>
          Токен от @BotFather{' '}
          <input
            id="token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
          />
        </label>
        <button id="discover" type="button" onClick={() => void discover()}>
          Найти группы
        </button>
        <div id="chats">
          {chats.map((chat) => (
            <label key={chat.id}>
              <input
                type="radio"
                name="chat"
                value={chat.id}
                checked={selected === chat.id}
                onChange={() => setSelected(chat.id)}
              />{' '}
              {chat.title}
              {chat.isForum ? '' : ' — включите темы'}
            </label>
          ))}
        </div>
        <button
          id="connect"
          type="button"
          hidden={!chats.length}
          onClick={() => void connect()}
        >
          Подключить
        </button>
      </section>
      <p id="status" role="status">
        {message}
      </p>
    </main>
  );
}
