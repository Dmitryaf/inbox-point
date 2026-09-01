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
    }),
  );
  saving.resolve(json({}));
  await screen.findByText(
    'Сохранено. Новые ответы уже доступны в Telegram и VK.',
  );
});
it('does not permit overwriting content when its initial load failed', async () => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
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
