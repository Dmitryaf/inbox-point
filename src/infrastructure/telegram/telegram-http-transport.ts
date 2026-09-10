import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici';

import type { TelegramFetch } from '@/infrastructure/telegram/telegram-api-client.js';

interface ProxyDispatcher {
  close(): Promise<void>;
}

const fetchViaDispatcher = undiciFetch as unknown as (
  input: string,
  init: RequestInit & { dispatcher: Dispatcher },
) => Promise<Response>;

export interface TelegramHttpTransportDependencies {
  createProxyDispatcher: (proxyUrl: URL) => ProxyDispatcher;
  directFetch: TelegramFetch;
  proxyFetch: (
    input: string,
    init: RequestInit | undefined,
    dispatcher: ProxyDispatcher,
  ) => Promise<Response>;
}

export interface TelegramHttpTransport {
  close(): Promise<void>;
  fetch: TelegramFetch;
}

const defaultDependencies: TelegramHttpTransportDependencies = {
  createProxyDispatcher: (proxyUrl) => new ProxyAgent(proxyUrl.toString()),
  directFetch: fetch,
  proxyFetch: (input, init, dispatcher) =>
    fetchViaDispatcher(input, {
      ...init,
      dispatcher: dispatcher as Dispatcher,
    }),
};

export function createTelegramHttpTransport(
  proxyUrl: URL | undefined,
  dependencies: TelegramHttpTransportDependencies = defaultDependencies,
): TelegramHttpTransport {
  if (!proxyUrl) {
    return {
      close: () => Promise.resolve(),
      fetch: dependencies.directFetch,
    };
  }

  const dispatcher = dependencies.createProxyDispatcher(proxyUrl);
  return {
    close: () => dispatcher.close(),
    fetch: (input, init) => dependencies.proxyFetch(input, init, dispatcher),
  };
}
