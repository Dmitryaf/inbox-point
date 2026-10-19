import { vi } from 'vitest';

import {
  requestUrl,
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';

export const password = 'synthetic-admin-password';

export function mockSession(
  authenticated = true,
  mode: 'password' | 'bypass' = 'password',
) {
  const overrides = new Map<
    string,
    (init?: RequestInit) => Promise<FakeResponse>
  >();
  const commands: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (init?.method === 'POST') {
      if (typeof init.body !== 'string') {
        throw new Error('Expected a JSON request body');
      }
      commands.push({ url, body: JSON.parse(init.body) as unknown });
    }
    const override = overrides.get(url);
    if (override) {
      return override(init);
    }
    if (url === '/api/admin/session') {
      return Promise.resolve(response({ authenticated, mode }));
    }
    if (url === '/api/admin/login') {
      if (typeof init?.body !== 'string') {
        throw new Error('Expected a JSON login body');
      }
      const body = JSON.parse(init.body) as { password: string };
      if (body.password !== password) {
        return Promise.resolve(response({ message: 'Неверный пароль.' }, 401));
      }
      authenticated = true;
      return Promise.resolve(response({ authenticated, mode }));
    }
    if (
      url === '/api/admin/logout' ||
      url === '/api/admin/sessions/revoke-all'
    ) {
      authenticated = false;
      return Promise.resolve(response({ authenticated, mode }));
    }
    if (url === '/api/manage/content') {
      return Promise.resolve(
        authenticated
          ? response({
              content: {
                organizationName: 'Учебная организация',
                schedule: '',
                scheduleItems: [],
              },
              version: 'a'.repeat(64),
            })
          : response({ message: 'Войдите, чтобы продолжить.' }, 401),
      );
    }
    if (url === '/api/manage/content/history') {
      return Promise.resolve(response({ history: [] }));
    }
    if (url === '/api/setup/status') {
      return Promise.resolve(
        response({
          connected: false,
          locked: false,
          source: 'none',
          vk: { connected: false, locked: false, source: 'none' },
        }),
      );
    }
    if (url.startsWith('/api/analytics?')) {
      return Promise.resolve(
        response({ summary: { requests: 0, menuActions: 0 } }),
      );
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { overrides, commands, fetchMock };
}
