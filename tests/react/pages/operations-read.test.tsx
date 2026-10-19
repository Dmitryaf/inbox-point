import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderApp } from '@test/react/support/render-app';
import { mockOperations } from '@test/react/support/mock-operations';
import { response } from '@test/frontend/support/fake-response';

afterEach(() => vi.useRealTimers());
it('recovers an initial failed read and retains stale status as unknown after a later failure', async () => {
  const api = mockOperations();
  api.overrides.set('/api/ops/status', () =>
    Promise.reject(new TypeError('Failed to fetch')),
  );
  renderApp('/ops');
  await screen.findByText('Состояние каналов неизвестно. Повторите проверку.');
  expect(screen.queryByText('Проверяем работу каналов…')).toBeNull();
  api.state.status.state = 'healthy';
  api.overrides.set('/api/ops/status', () =>
    Promise.resolve(response(api.state.status)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Повторить проверку' }));
  await screen.findByText('Всё работает');
  api.overrides.set('/api/ops/status', () =>
    Promise.resolve(
      response({ message: 'Не удалось обновить состояние.' }, 503),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Обновить' }));
  await screen.findByText('Состояние неизвестно');
  expect(screen.getByText(/Показаны последние данные от/)).toBeDefined();
  expect(screen.queryByText('Всё работает')).toBeNull();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});

it('runs exactly one 30-second polling timer, preserves the conversation node and stops on unmount', async () => {
  const api = mockOperations(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { unmount } = renderApp('/ops');
  await screen.findByText('Message A');
  const list = screen.getByRole('list', { name: 'Переписка' });
  list.scrollTop = 120;
  list.focus();
  const reads = () =>
    api.fetchMock.mock.calls.filter(([input]) => input === '/api/ops/status')
      .length;
  const before = reads();
  expect(vi.getTimerCount()).toBe(1);
  await act(async () => {
    vi.advanceTimersByTime(29_999);
    await Promise.resolve();
  });
  expect(reads()).toBe(before);
  await act(async () => {
    vi.advanceTimersByTime(1);
    await Promise.resolve();
  });
  await waitFor(() => expect(reads()).toBe(before + 1));
  expect(screen.getByRole('list', { name: 'Переписка' })).toBe(list);
  expect(list.scrollTop).toBe(120);
  expect(document.activeElement).toBe(list);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
  await act(async () => {
    vi.advanceTimersByTime(60_000);
    await Promise.resolve();
  });
  expect(reads()).toBe(before + 1);
});
