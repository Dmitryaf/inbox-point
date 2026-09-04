import { useEffect, useRef, useState } from 'react';
import { request } from './setup-api';
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
      if (!owner.current.active || sequence !== owner.current.sequence) {
        return;
      }
      setFailures(status.failures);
      setMessage(
        status.summary.failed === 0 && status.summary.pending === 0
          ? 'Все ответы доставлены.'
          : `Ожидают отправки: ${status.summary.pending}. Не доставлено: ${status.summary.failed}.`,
      );
    } catch {
      if (!owner.current.active || sequence !== owner.current.sequence) {
        return;
      }
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
      if (owner.current.active) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Не удалось повторить отправку. Обновите страницу.',
        );
      }
    } finally {
      if (owner.current.active) {
        setPending(
          (current) => new Set([...current].filter((value) => value !== id)),
        );
      }
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
