import { useEffect, useState } from 'react';

interface CustomSection {
  label: string;
  text: string;
}
interface Content {
  address: string;
  customSections: CustomSection[];
  faq: { question: string; answer: string }[];
  prices: string;
  schedule: string;
}
interface HistoryEntry {
  changedAt: string;
  sections: (keyof Content)[];
}
class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: data === undefined ? {} : { 'content-type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new ApiError(
      typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : 'Не удалось выполнить действие.',
      response.status,
    );
  return body as T;
}
const empty: Content = {
  address: '',
  customSections: [],
  faq: [],
  prices: '',
  schedule: '',
};
const labels = {
  address: 'адрес',
  customSections: 'дополнительные кнопки',
  faq: 'частые вопросы',
  prices: 'цены',
  schedule: 'расписание',
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось выполнить действие.';
function listText(label: string, value: string) {
  const items = value
    .split(/\r?\n/)
    .map((item) => item.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);
  return items.length
    ? label + '\n\n' + items.map((item) => '• ' + item).join('\n')
    : '';
}
function faqText(items: Content['faq']) {
  return items.length
    ? 'Частые вопросы\n\n' +
        items
          .map(
            (item) => '❓ ' + item.question.trim() + '\n' + item.answer.trim(),
          )
          .join('\n\n────────\n\n')
    : 'Частые вопросы пока не добавлены. Вы можете задать вопрос преподавателю.';
}

export function ManagePage() {
  const [session, setSession] = useState<'loading' | 'login' | 'editor'>(
    'loading',
  );
  const [password, setPassword] = useState('');
  const [content, setContent] = useState<Content>(empty);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  function fail(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      setSession('login');
      setLoaded(false);
      setStatus('Сессия завершилась. Войдите снова.');
    } else setStatus(message(error));
  }
  async function loadHistory() {
    const response = await request<{ history: HistoryEntry[] }>(
      '/api/manage/content/history',
    );
    setHistory(response.history);
  }
  async function showEditor() {
    setSession('editor');
    setLoaded(false);
    try {
      const value = await request<Partial<Content>>('/api/manage/content');
      setContent({ ...empty, ...value });
      await loadHistory();
      setLoaded(true);
      setStatus('Информация загружена.');
    } catch (error: unknown) {
      fail(error);
    }
  }
  useEffect(() => {
    let active = true;
    void request<{ authenticated: boolean }>('/api/manage/session').then(
      async (value) => {
        if (!active) return;
        if (value.authenticated) await showEditor();
        else setSession('login');
      },
      (error) => {
        if (active) {
          setSession('login');
          setStatus(message(error));
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);
  async function login() {
    setPending(true);
    setStatus('Проверяем пароль…');
    try {
      await request('/api/manage/login', { password });
      setPassword('');
      await showEditor();
    } catch (error: unknown) {
      setStatus(message(error));
    } finally {
      setPending(false);
    }
  }
  async function save() {
    setPending(true);
    setStatus('Сохраняем…');
    try {
      await request('/api/manage/content', content);
      setStatus('Сохранено. Новые ответы уже доступны в Telegram и VK.');
      await loadHistory();
    } catch (error: unknown) {
      fail(error);
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    setPending(true);
    try {
      await request('/api/manage/logout', {});
    } finally {
      setSession('login');
      setLoaded(false);
      setStatus('Вы вышли.');
      setPending(false);
    }
  }
  function updateSection(index: number, value: Partial<CustomSection>) {
    setContent({
      ...content,
      customSections: content.customSections.map((item, position) =>
        position === index ? { ...item, ...value } : item,
      ),
    });
  }
  const previews = [
    { label: 'Расписание', text: listText('Расписание', content.schedule) },
    { label: 'Цены', text: listText('Цены', content.prices) },
    {
      label: 'Адрес',
      text: content.address.trim() ? 'Адрес\n\n' + content.address.trim() : '',
    },
    {
      label: 'Частые вопросы',
      text: faqText(
        content.faq.filter(
          (item) => item.question.trim() && item.answer.trim(),
        ),
      ),
    },
    ...content.customSections.map((section) => ({
      label: section.label.trim() || 'Новая кнопка',
      text: section.text.trim(),
    })),
  ];
  if (session === 'loading')
    return (
      <main>
        <p role="status">Проверяем доступ…</p>
      </main>
    );
  if (session === 'login')
    return (
      <main>
        <section id="login-section">
          <h1>Вход</h1>
          <p>Введите пароль, который выдал администратор сервиса.</p>
          <form
            id="login-form"
            onSubmit={(event) => {
              event.preventDefault();
              void login();
            }}
          >
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <button type="submit" disabled={pending}>
              Войти
            </button>
          </form>
          <p
            id="login-status"
            className="status"
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
        </section>
      </main>
    );
  return (
    <main>
      <div id="editor">
        <header>
          <div>
            <h1>Информация для клиентов</h1>
            <p>Изменения сразу появятся в Telegram и VK.</p>
          </div>
          <button
            id="logout"
            className="secondary"
            type="button"
            disabled={pending}
            onClick={() => void logout()}
          >
            Выйти
          </button>
        </header>
        <form
          id="content-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <section>
            <h2>Основная информация</h2>
            {(['schedule', 'prices', 'address'] as const).map((field) => (
              <div key={field}>
                <label htmlFor={field}>
                  {
                    {
                      schedule: 'Расписание',
                      prices: 'Цены',
                      address: 'Адрес',
                    }[field]
                  }
                </label>
                {field !== 'address' && (
                  <p className="hint">
                    {field === 'schedule'
                      ? 'Каждое занятие указывайте с новой строки.'
                      : 'Каждый вариант оплаты указывайте с новой строки.'}
                  </p>
                )}
                <textarea
                  id={field}
                  rows={field === 'address' ? 3 : 6}
                  maxLength={4000}
                  disabled={!loaded || pending}
                  value={content[field]}
                  onChange={(event) =>
                    setContent({
                      ...content,
                      [field]: event.currentTarget.value,
                    })
                  }
                />
              </div>
            ))}
          </section>
          <section>
            <h2>Частые вопросы</h2>
            <p>
              Добавляйте вопросы и ответы отдельными карточками. Порядок
              карточек сохранится в сообщении.
            </p>
            <div id="faq-items">
              {content.faq.map((item, index) => (
                <div className="faq-item" key={index}>
                  <h3>Вопрос и ответ</h3>
                  <label>
                    Вопрос
                    <input
                      type="text"
                      maxLength={300}
                      required
                      disabled={pending}
                      value={item.question}
                      onChange={(event) =>
                        setContent({
                          ...content,
                          faq: content.faq.map((value, position) =>
                            position === index
                              ? {
                                  ...value,
                                  question: event.currentTarget.value,
                                }
                              : value,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Ответ
                    <textarea
                      rows={4}
                      maxLength={3000}
                      required
                      disabled={pending}
                      value={item.answer}
                      onChange={(event) =>
                        setContent({
                          ...content,
                          faq: content.faq.map((value, position) =>
                            position === index
                              ? { ...value, answer: event.currentTarget.value }
                              : value,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="remove"
                    disabled={pending}
                    onClick={() =>
                      setContent({
                        ...content,
                        faq: content.faq.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    Удалить вопрос
                  </button>
                </div>
              ))}
            </div>
            <button
              id="add-faq"
              className="secondary"
              type="button"
              disabled={!loaded || pending || content.faq.length >= 20}
              onClick={() =>
                setContent({
                  ...content,
                  faq: [...content.faq, { question: '', answer: '' }],
                })
              }
            >
              Добавить вопрос
            </button>
          </section>
          <section>
            <h2>Дополнительные кнопки</h2>
            <p>Добавьте до шести собственных информационных разделов.</p>
            <div id="custom-sections">
              {content.customSections.map((section, index) => (
                <div className="custom-section" key={index}>
                  <h3>Дополнительная кнопка</h3>
                  <label>
                    Название кнопки
                    <input
                      type="text"
                      maxLength={40}
                      required
                      disabled={pending}
                      value={section.label}
                      onChange={(event) =>
                        updateSection(index, {
                          label: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Ответ
                    <textarea
                      rows={6}
                      maxLength={4000}
                      required
                      disabled={pending}
                      value={section.text}
                      onChange={(event) =>
                        updateSection(index, {
                          text: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="remove"
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
                </div>
              ))}
            </div>
            <button
              id="add-section"
              className="secondary"
              type="button"
              disabled={
                !loaded || pending || content.customSections.length >= 6
              }
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
          </section>
          <section>
            <h2>Предпросмотр</h2>
            <p className="hint">
              Так текст будет выглядеть у клиента. Пустые разделы не
              показываются.
            </p>
            <div id="preview">
              {previews
                .filter((item) => item.text)
                .map((item, index) => (
                  <article className="preview-card" key={index}>
                    <h3>{item.label}</h3>
                    <p className="preview-text">{item.text}</p>
                  </article>
                ))}
            </div>
          </section>
          <div className="save-bar">
            <button id="save" type="submit" disabled={!loaded || pending}>
              Сохранить изменения
            </button>
            <p
              id="save-status"
              className="status"
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          </div>
        </form>
        <section>
          <h2>Последние изменения</h2>
          <ul id="history">
            {history.map((entry, index) => (
              <li key={index}>
                {new Date(entry.changedAt).toLocaleString('ru-RU')}:{' '}
                {entry.sections.map((section) => labels[section]).join(', ')}
              </li>
            ))}
          </ul>
          {history.length === 0 && (
            <p id="history-empty" className="hint">
              Изменений пока нет.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
