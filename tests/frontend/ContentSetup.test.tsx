// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ContentSetup } from '../../frontend/src/ContentSetup';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('loads existing values, preserves a failed draft and saves the edited fields after retry', async () => {
  const saving = Promise.withResolvers<Response>();
  const fetchMock = vi
    .fn<(path: string, options?: RequestInit) => Promise<Response>>()
    .mockResolvedValueOnce(
      json({ schedule: 'Понедельник', prices: '1000', address: 'Улица' }),
    )
    .mockResolvedValueOnce(json({ message: 'Не удалось записать файл.' }, 500))
    .mockImplementationOnce(() => saving.promise);
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentSetup />);
  await screen.findByText('Изменения применяются без перезапуска.');
  expect(screen.getByLabelText<HTMLTextAreaElement>('Расписание').value).toBe(
    'Понедельник',
  );
  fireEvent.change(screen.getByLabelText('Цены'), {
    target: { value: '1500' },
  });
  const button = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Сохранить информацию',
  });
  fireEvent.click(button);
  await screen.findByText('Не удалось записать файл.');
  expect(screen.getByLabelText<HTMLTextAreaElement>('Цены').value).toBe('1500');
  fireEvent.click(button);
  await screen.findByText('Сохраняем…');
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
    JSON.stringify({
      schedule: 'Понедельник',
      prices: '1500',
      address: 'Улица',
      customSections: [],
    }),
  );
  saving.resolve(json({}));
  await screen.findByText(
    'Сохранено. Новые ответы уже доступны в Telegram и VK.',
  );
});
it('does not permit overwriting content when its initial load failed', async () => {
  const fetchMock = vi
    .fn<(path: string, options?: RequestInit) => Promise<Response>>()
    .mockRejectedValue(new Error('offline'));
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentSetup />);
  await screen.findByText(
    'Не удалось загрузить информацию. Обновите страницу.',
  );
  const button = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Сохранить информацию',
  });
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('edits and removes custom sections without losing the remaining rows and limits additions to six', async () => {
  const fetchMock = vi
    .fn<(path: string, options?: RequestInit) => Promise<Response>>()
    .mockResolvedValueOnce(
      json({
        schedule: '',
        prices: '',
        address: '',
        customSections: [
          { label: 'Первое занятие', text: 'Начальный ответ' },
          { label: 'Одежда', text: 'Форма' },
        ],
      }),
    )
    .mockResolvedValueOnce(json({}));
  vi.stubGlobal('fetch', fetchMock);
  render(<ContentSetup />);
  await screen.findByText('Изменения применяются без перезапуска.');
  fireEvent.change(screen.getAllByLabelText('Ответ')[1]!, {
    target: { value: 'Удобная форма' },
  });
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Удалить кнопку' })[0]!,
  );
  expect(screen.getByLabelText<HTMLInputElement>('Название кнопки').value).toBe(
    'Одежда',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить информацию' }));
  await screen.findByText(
    'Сохранено. Новые ответы уже доступны в Telegram и VK.',
  );
  expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
    JSON.stringify({
      schedule: '',
      prices: '',
      address: '',
      customSections: [{ label: 'Одежда', text: 'Удобная форма' }],
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
