import { getGlobalDispatcher } from 'undici';
import { describe, expect, it, vi } from 'vitest';

import { createTelegramHttpTransport } from '@/infrastructure/telegram/telegram-http-transport.js';

describe('createTelegramHttpTransport', () => {
  it('uses the direct fetch implementation when no proxy is configured', async () => {
    const response = new Response('{}', { status: 200 });
    const directFetch = vi.fn(() => Promise.resolve(response));
    const createProxyDispatcher = vi.fn();
    const proxyFetch = vi.fn();
    const transport = createTelegramHttpTransport(undefined, {
      createProxyDispatcher,
      directFetch,
      proxyFetch,
    });

    await expect(
      transport.fetch('https://api.telegram.org/bot-token/getMe'),
    ).resolves.toBe(response);
    await expect(transport.close()).resolves.toBeUndefined();
    expect(directFetch).toHaveBeenCalledOnce();
    expect(createProxyDispatcher).not.toHaveBeenCalled();
    expect(proxyFetch).not.toHaveBeenCalled();
  });

  it('uses and closes a dedicated dispatcher only for Telegram requests', async () => {
    const dispatcher = { close: vi.fn(() => Promise.resolve()) };
    const directFetch = vi.fn();
    const proxyFetch = vi.fn(() =>
      Promise.resolve(new Response('{}', { status: 200 })),
    );
    const proxyUrl = new URL('http://10.77.0.2:8888');
    const createProxyDispatcher = vi.fn(() => dispatcher);
    const transport = createTelegramHttpTransport(proxyUrl, {
      createProxyDispatcher,
      directFetch,
      proxyFetch,
    });

    await transport.fetch('https://api.telegram.org/bot-token/getUpdates', {
      method: 'POST',
    });
    await transport.close();

    expect(createProxyDispatcher).toHaveBeenCalledWith(proxyUrl);
    expect(proxyFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bot-token/getUpdates',
      { method: 'POST' },
      dispatcher,
    );
    expect(directFetch).not.toHaveBeenCalled();
    expect(dispatcher.close).toHaveBeenCalledOnce();
  });

  it('does not replace the process-wide dispatcher', async () => {
    const globalDispatcher = getGlobalDispatcher();
    const transport = createTelegramHttpTransport(
      new URL('http://10.77.0.2:8888'),
    );

    expect(getGlobalDispatcher()).toBe(globalDispatcher);
    await transport.close();
  });

  it('does not fall back to a direct request when the proxy fails', async () => {
    const failure = new Error('proxy unavailable');
    const directFetch = vi.fn();
    const proxyFetch = vi.fn(() => Promise.reject(failure));
    const transport = createTelegramHttpTransport(
      new URL('http://10.77.0.2:8888'),
      {
        createProxyDispatcher: () => ({ close: () => Promise.resolve() }),
        directFetch,
        proxyFetch,
      },
    );

    await expect(
      transport.fetch('https://api.telegram.org/bot-token/getMe'),
    ).rejects.toBe(failure);
    expect(directFetch).not.toHaveBeenCalled();
  });
});
