import { useEffect, useState } from 'react';

type Status = 'loading' | 'ready' | 'error';

export function App() {
  const [status, setStatus] = useState<Status>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all(
      ['/health', '/ready'].map(async (path) => {
        const response = await fetch(path, { signal: controller.signal });
        if (!response.ok) throw new Error('Service is unavailable');
      }),
    ).then(
      () => {
        if (!controller.signal.aborted) setStatus('ready');
      },
      () => {
        if (!controller.signal.aborted) setStatus('error');
      },
    );
    return () => controller.abort();
  }, [attempt]);

  return (
    <main>
      <h1>Messenger Handoff</h1>
      <p>Рабочее пространство для обращений из Telegram и VK.</p>
      {status === 'loading' && <p role="status">Проверяем сервис…</p>}
      {status === 'ready' && <p role="status">Сервис готов к работе.</p>}
      {status === 'error' && (
        <section role="alert">
          <p>Сервис пока недоступен. Повторите проверку.</p>
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              setAttempt((value) => value + 1);
            }}
          >
            Проверить ещё раз
          </button>
        </section>
      )}
    </main>
  );
}
