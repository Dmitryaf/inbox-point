import { useState } from 'react';
import { request } from './setup-api';
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
