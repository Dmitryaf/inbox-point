import { useEffect, useState } from 'react';
import { request } from './setup-api';

interface Content {
  schedule: string;
  prices: string;
  address: string;
}
export function ContentSetup() {
  const [content, setContent] = useState<Content>({
    schedule: '',
    prices: '',
    address: '',
  });
  const [message, setMessage] = useState('Загружаем сохранённые значения…');
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const owner = new AbortController();
    void request<Content>('/api/setup/content', undefined, owner.signal).then(
      (value) => {
        if (owner.signal.aborted) return;
        setContent({
          schedule: value.schedule ?? '',
          prices: value.prices ?? '',
          address: value.address ?? '',
        });
        setLoaded(true);
        setMessage('Изменения применяются без перезапуска.');
      },
      () => {
        if (!owner.signal.aborted)
          setMessage('Не удалось загрузить информацию. Обновите страницу.');
      },
    );
    return () => owner.abort();
  }, []);
  async function save() {
    setPending(true);
    setMessage('Сохраняем…');
    try {
      await request('/api/setup/content', content);
      setMessage('Сохранено. Новые ответы уже доступны в Telegram и VK.');
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось сохранить информацию. Повторите действие.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-labelledby="content-title">
      <h2 id="content-title">Информация для клиентов</h2>
      <p>
        Эти ответы одинаково отображаются в Telegram и VK. Пустой раздел будет
        отмечен как не заполненный.
      </p>
      {(['schedule', 'prices', 'address'] as const).map((field) => (
        <label key={field}>
          {{ schedule: 'Расписание', prices: 'Цены', address: 'Адрес' }[field]}
          <textarea
            id={'content-' + field}
            rows={field === 'address' ? 3 : 5}
            value={content[field]}
            disabled={!loaded || pending}
            onChange={(event) =>
              setContent({ ...content, [field]: event.currentTarget.value })
            }
          />
        </label>
      ))}
      <button
        id="save-content"
        type="button"
        disabled={!loaded || pending}
        onClick={() => void save()}
      >
        Сохранить информацию
      </button>
      <p id="content-status" role="status" className="muted">
        {message}
      </p>
    </section>
  );
}
