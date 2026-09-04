// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryPanel, VkSetup } from '@legacy/ServiceTools';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('service tools', () => {
  it('preserves VK credentials after failure, prevents pending duplicates and clears the key only after confirmation', async () => {
    const connecting = Promise.withResolvers<Response>();
    const fetchMock = vi
      .fn<(path: string, options?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        json({ connected: true, vk: { connected: false } }),
      )
      .mockResolvedValueOnce(
        json({ message: 'Проверьте права сообщества.' }, 400),
      )
      .mockImplementationOnce(() => connecting.promise);
    vi.stubGlobal('fetch', fetchMock);
    render(<VkSetup />);
    await screen.findByText('Выполните три шага выше.');
    const key = screen.getByLabelText<HTMLInputElement>(
      'Ключ доступа сообщества',
    );
    fireEvent.change(key, { target: { value: ' synthetic-key ' } });
    fireEvent.change(screen.getByLabelText('Ссылка на сообщество'), {
      target: { value: ' https://vk.com/test ' },
    });
    const button = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Подключить VK',
    });
    fireEvent.click(button);
    await screen.findByText('Проверьте права сообщества.');
    expect(key.value).toBe(' synthetic-key ');
    fireEvent.click(button);
    await screen.findByText('Подключаем VK…');
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({
        accessToken: 'synthetic-key',
        community: 'https://vk.com/test',
      }),
    );
    connecting.resolve(json({ connected: true }));
    await screen.findByText('VK подключён. Настройка сохранена.');
    expect(key.value).toBe('');
    expect(document.getElementById('vk-wizard')?.hidden).toBe(true);
  });

  it('retries the selected delivery once even when refreshing its result fails', async () => {
    const retrying = Promise.withResolvers<Response>();
    const fetchMock = vi
      .fn<(path: string, options?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        json({
          summary: { pending: 0, failed: 1 },
          failures: [
            {
              id: 'delivery-vk-42',
              channel: 'VK',
              attempts: 3,
              reason: 'Нет доступа',
              createdAt: '2026-09-01T00:00:00Z',
            },
          ],
        }),
      )
      .mockImplementationOnce(() => retrying.promise)
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    render(<DeliveryPanel />);
    const retry = await screen.findByRole<HTMLButtonElement>('button', {
      name: 'Повторить отправку',
    });
    fireEvent.click(retry);
    await screen.findByText('Возвращаем ответ в очередь…');
    expect(retry.disabled).toBe(true);
    fireEvent.click(retry);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ deliveryId: 'delivery-vk-42' }),
    );
    retrying.resolve(json({ queued: true }));
    await screen.findByText(
      'Не удалось проверить доставку. Обновите страницу.',
    );
    expect(
      fetchMock.mock.calls.filter(([path]) => path.endsWith('/retry')),
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Повторить отправку' }),
    ).toBeNull();
  });

  it('polls deliveries and stops polling after unmount', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          json({ summary: { failed: 0, pending: 0 }, failures: [] }),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<DeliveryPanel />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status').textContent).toBe(
      'Все ответы доставлены.',
    );
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
