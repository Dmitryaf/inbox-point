import { useEffect, useRef, useState } from 'react';
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
        if (controller.signal.aborted) return;
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
        if (!controller.signal.aborted)
          setMessage('Не удалось проверить подключение. Обновите страницу.');
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

interface DeliveryFailure {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  reason: string;
}

interface DeliveryStatus {
  summary: { failed: number; pending: number };
  failures: DeliveryFailure[];
}

export function DeliveryPanel() {
  const [failures, setFailures] = useState<DeliveryFailure[]>([]);
  const [message, setMessage] = useState('Проверяем состояние…');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const owner = useRef({ active: true, sequence: 0 });

  async function refresh(): Promise<void> {
    const sequence = ++owner.current.sequence;
    try {
      const status = await request<DeliveryStatus>('/api/setup/deliveries');
      if (!owner.current.active || sequence !== owner.current.sequence) return;
      setFailures(status.failures);
      setMessage(
        status.summary.failed === 0 && status.summary.pending === 0
          ? 'Все ответы доставлены.'
          : `Ожидают отправки: ${status.summary.pending}. Не доставлено: ${status.summary.failed}.`,
      );
    } catch {
      if (!owner.current.active || sequence !== owner.current.sequence) return;
      setFailures([]);
      setMessage('Не удалось проверить доставку. Обновите страницу.');
    }
  }

  useEffect(() => {
    owner.current.active = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 10_000);
    return () => {
      owner.current.active = false;
      owner.current.sequence++;
      clearInterval(timer);
    };
  }, []);

  async function retry(id: string): Promise<void> {
    setPending((current) => new Set([...current, id]));
    setMessage('Возвращаем ответ в очередь…');
    try {
      await request('/api/setup/deliveries/retry', { deliveryId: id });
      await refresh();
    } catch (error: unknown) {
      if (owner.current.active)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Не удалось повторить отправку. Обновите страницу.',
        );
    } finally {
      if (owner.current.active)
        setPending(
          (current) => new Set([...current].filter((value) => value !== id)),
        );
    }
  }

  return (
    <section aria-labelledby="delivery-title">
      <h2 id="delivery-title">Доставка ответов</h2>
      <p id="delivery-summary" role="status">
        {message}
      </p>
      <ul id="delivery-failures">
        {failures.map((failure) => (
          <li key={failure.id}>
            {failure.channel}: {failure.reason} Попыток: {failure.attempts}.{' '}
            <button
              type="button"
              disabled={pending.has(failure.id)}
              onClick={() => void retry(failure.id)}
            >
              Повторить отправку
            </button>
          </li>
        ))}
      </ul>
      <button
        id="refresh-deliveries"
        type="button"
        onClick={() => void refresh()}
      >
        Обновить
      </button>
      <p className="muted">
        Тексты сообщений и данные клиентов здесь не отображаются.
      </p>
    </section>
  );
}

export function BackupPanel() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('Токен Telegram в копию не входит.');

  async function create(): Promise<void> {
    setPending(true);
    setMessage('Создаём и проверяем копию…');
    try {
      const created = await request<{ fileName: string }>(
        '/api/setup/backups',
        {},
      );
      setMessage(`Резервная копия создана: ${created.fileName}.`);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось создать резервную копию. Попробуйте ещё раз.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="backup-title">
      <h2 id="backup-title">Резервная копия</h2>
      <p>
        Сохраните обращения и очередь доставки перед обновлением или переносом
        сервиса.
      </p>
      <button
        id="create-backup"
        type="button"
        disabled={pending}
        onClick={() => void create()}
      >
        Создать резервную копию
      </button>
      <p id="backup-status" role="status" className="muted">
        {message}
      </p>
    </section>
  );
}
