// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Service foundation', () => {
  it('confirms readiness only after both endpoints succeed', async () => {
    const readiness = Promise.withResolvers<Response>();
    const fetchMock = vi.fn((path: string) =>
      path === '/ready'
        ? readiness.promise
        : Promise.resolve(new Response('{}', { status: 200 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    expect(screen.getByRole('status').textContent).toBe('Проверяем сервис…');
    readiness.resolve(new Response('{}', { status: 200 }));
    await screen.findByText('Сервис готов к работе.');
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/health',
      '/ready',
    ]);
  });

  it('shows an unavailable endpoint and permits an explicit retry', async () => {
    const fetchMock = vi
      .fn<(...args: unknown[]) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Проверить ещё раз' }));
    await screen.findByText('Сервис готов к работе.');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
