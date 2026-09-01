import { useEffect, useState } from 'react';
import { request } from './setup-api';

interface Content {
  schedule: string;
  prices: string;
  address: string;
  customSections: { label: string; text: string }[];
}
export function ContentSetup() {
  const [content, setContent] = useState<Content>({
    schedule: '',
    prices: '',
    address: '',
    customSections: [],
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
          customSections: value.customSections ?? [],
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
      <h3>Дополнительные кнопки</h3>
      <p className="muted">
        Можно добавить до шести собственных разделов, например «Первое занятие»
        или «Что взять с собой».
      </p>
      <div id="custom-sections">
        {content.customSections.map((section, index) => (
          <div className="custom-section" key={index}>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                setContent({
                  ...content,
                  customSections: content.customSections.filter(
                    (_, position) => position !== index,
                  ),
                })
              }
            >
              Удалить кнопку
            </button>
            <label>
              Название кнопки
              <input
                type="text"
                maxLength={40}
                value={section.label}
                disabled={pending}
                onChange={(event) =>
                  setContent({
                    ...content,
                    customSections: content.customSections.map(
                      (item, position) =>
                        position === index
                          ? { ...item, label: event.currentTarget.value }
                          : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              Ответ
              <textarea
                rows={4}
                maxLength={4000}
                value={section.text}
                disabled={pending}
                onChange={(event) =>
                  setContent({
                    ...content,
                    customSections: content.customSections.map(
                      (item, position) =>
                        position === index
                          ? { ...item, text: event.currentTarget.value }
                          : item,
                    ),
                  })
                }
              />
            </label>
          </div>
        ))}
      </div>
      <button
        id="add-custom-section"
        type="button"
        disabled={!loaded || pending || content.customSections.length >= 6}
        onClick={() =>
          setContent({
            ...content,
            customSections: [
              ...content.customSections,
              { label: '', text: '' },
            ],
          })
        }
      >
        Добавить кнопку
      </button>
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
