import { useEffect, useState } from 'react';
import { request } from './setup-api';
export function VkSetup() {
  const [connected, setConnected] = useState<boolean | undefined>();
  const [token, setToken] = useState('');
  const [community, setCommunity] = useState('');
  const [message, setMessage] = useState('Проверяем состояние…');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void request<{ connected: boolean; vk: { connected: boolean } }>(
      '/api/setup/status',
      undefined,
      controller.signal,
    ).then(
      (status) => {
        if (controller.signal.aborted) {
          return;
        }
        setConnected(status.vk.connected);
        setMessage(
          status.vk.connected
            ? 'VK подключён.'
            : status.connected
              ? 'Выполните три шага выше.'
              : 'Сначала подключите Telegram для преподавателей.',
        );
      },
      () => {
        if (!controller.signal.aborted) {
          setMessage('Не удалось проверить подключение. Обновите страницу.');
        }
      },
    );
    return () => controller.abort();
  }, []);

  async function connect(): Promise<void> {
    setPending(true);
    setMessage('Подключаем VK…');
    try {
      await request('/api/setup/vk/connect', {
        accessToken: token.trim(),
        community: community.trim(),
      });
      setToken('');
      setConnected(true);
      setMessage('VK подключён. Настройка сохранена.');
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось подключить VK. Повторите действие.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="vk-title">
      <h2 id="vk-title">Подключение VK</h2>
      <div id="vk-wizard" hidden={connected !== false}>
        <ol>
          <li>
            Откройте «Сообщения → Настройки для бота» и включите «Возможности
            ботов».
          </li>
          <li>
            В управлении сообществом откройте «Работа с API» и включите Long
            Poll API.
          </li>
          <li>В событиях Long Poll отметьте «Входящие сообщения».</li>
          <li>
            Создайте ключ доступа сообщества с правом работы с сообщениями.
          </li>
        </ol>
        <label>
          Ссылка на сообщество{' '}
          <input
            id="vk-community"
            type="text"
            placeholder="https://vk.com/your_community"
            value={community}
            onChange={(event) => setCommunity(event.currentTarget.value)}
          />
        </label>
        <label>
          Ключ доступа сообщества{' '}
          <input
            id="vk-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
          />
        </label>
        <button
          id="vk-connect"
          type="button"
          disabled={pending}
          onClick={() => void connect()}
        >
          Подключить VK
        </button>
      </div>
      <p id="vk-status" role="status">
        {message}
      </p>
    </section>
  );
}
