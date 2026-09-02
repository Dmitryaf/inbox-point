// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ManagePage } from '../../frontend/src/ManagePage';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const content = {
  address: 'Улица',
  customSections: [],
  prices: '1000',
  schedule: 'Понедельник',
};
const mock = () =>
  vi.fn<(path: string, options?: RequestInit) => Promise<Response>>();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('authenticates, preserves a rejected password and displays persisted content after confirmation', async () => {
  const loggingIn = Promise.withResolvers<Response>();
  const fetchMock = mock()
    .mockResolvedValueOnce(json({ authenticated: false }))
    .mockResolvedValueOnce(json({ message: 'Неверный пароль.' }, 401))
    .mockImplementationOnce(() => loggingIn.promise)
    .mockResolvedValueOnce(json(content))
    .mockResolvedValueOnce(json({ history: [] }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ManagePage />);
  const password = await screen.findByLabelText<HTMLInputElement>('Пароль');
  fireEvent.change(password, { target: { value: 'synthetic-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByText('Неверный пароль.');
  expect(password.value).toBe('synthetic-password');
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }));
  await screen.findByText('Проверяем пароль…');
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Войти' }).disabled,
  ).toBe(true);
  expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
    JSON.stringify({ password: 'synthetic-password' }),
  );
  loggingIn.resolve(json({ authenticated: true }));
  await screen.findByText('Информация загружена.');
  expect(screen.getByLabelText<HTMLTextAreaElement>('Расписание').value).toBe(
    'Понедельник',
  );
  expect(screen.queryByLabelText('Пароль')).toBeNull();
});
it('preserves a failed draft, locks a pending save and refreshes history after the confirmed write', async () => {
  const saving = Promise.withResolvers<Response>();
  const fetchMock = mock()
    .mockResolvedValueOnce(json({ authenticated: true }))
    .mockResolvedValueOnce(json(content))
    .mockResolvedValueOnce(json({ history: [] }))
    .mockResolvedValueOnce(json({ message: 'Не удалось записать файл.' }, 500))
    .mockImplementationOnce(() => saving.promise)
    .mockResolvedValueOnce(
      json({
        history: [{ changedAt: '2026-09-02T00:00:00Z', sections: ['prices'] }],
      }),
    );
  vi.stubGlobal('fetch', fetchMock);
  render(<ManagePage />);
  await screen.findByText('Информация загружена.');
  fireEvent.change(screen.getByLabelText('Цены'), {
    target: { value: '1500' },
  });
  const button = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Сохранить изменения',
  });
  fireEvent.click(button);
  await screen.findByText('Не удалось записать файл.');
  expect(screen.getByLabelText<HTMLTextAreaElement>('Цены').value).toBe('1500');
  fireEvent.click(button);
  await screen.findByText('Сохраняем…');
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  expect(fetchMock.mock.calls[4]?.[1]?.body).toBe(
    JSON.stringify({ ...content, prices: '1500' }),
  );
  saving.resolve(json({}));
  await screen.findByText(
    'Сохранено. Новые ответы уже доступны в Telegram и VK.',
  );
  await screen.findByText(/: цены$/);
});
it('requires login when the content session expired without permitting an empty overwrite', async () => {
  const fetchMock = mock()
    .mockResolvedValueOnce(json({ authenticated: true }))
    .mockResolvedValueOnce(json({ message: 'Нет доступа' }, 401));
  vi.stubGlobal('fetch', fetchMock);
  render(<ManagePage />);
  await screen.findByText('Сессия завершилась. Войдите снова.');
  expect(
    screen.queryByRole('button', { name: 'Сохранить изменения' }),
  ).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('edits and removes custom sections, limits them to six and renders FAQ previews as text', async () => {
  const fetchMock = mock()
    .mockResolvedValueOnce(json({ authenticated: true }))
    .mockResolvedValueOnce(
      json({
        ...content,
        customSections: [
          { label: 'Первое занятие', text: 'Начальный ответ' },
          { label: 'Одежда', text: 'Форма' },
        ],
      }),
    )
    .mockResolvedValueOnce(json({ history: [] }))
    .mockResolvedValueOnce(json({}))
    .mockResolvedValueOnce(json({ history: [] }));
  vi.stubGlobal('fetch', fetchMock);
  render(<ManagePage />);
  await screen.findByText('Информация загружена.');
  fireEvent.change(screen.getAllByLabelText('Ответ')[1]!, {
    target: { value: '<img src=x>\nУдобная форма' },
  });
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Удалить кнопку' })[0]!,
  );
  expect(screen.getByLabelText<HTMLInputElement>('Название кнопки').value).toBe(
    'Одежда',
  );
  fireEvent.change(screen.getByLabelText('Формат ответа'), {
    target: { value: 'faq' },
  });
  expect(document.querySelector('img')).toBeNull();
  expect(document.getElementById('preview')?.textContent).toContain(
    '❓ <img src=x>\nУдобная форма',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await screen.findByText(
    'Сохранено. Новые ответы уже доступны в Telegram и VK.',
  );
  expect(fetchMock.mock.calls[3]?.[1]?.body).toBe(
    JSON.stringify({
      ...content,
      customSections: [
        { label: 'Одежда', text: '<img src=x>\nУдобная форма', format: 'faq' },
      ],
    }),
  );
  const add = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Добавить кнопку',
  });
  for (let i = 0; i < 5; i++) fireEvent.click(add);
  expect(add.disabled).toBe(true);
  expect(screen.getAllByLabelText('Название кнопки')).toHaveLength(6);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Удалить кнопку' })[5]!,
  );
  expect(add.disabled).toBe(false);
});
