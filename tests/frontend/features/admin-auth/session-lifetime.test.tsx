import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, type ReactNode } from 'react';
import { expect, it } from 'vitest';

import { createAppQueryClient } from '@frontend/app/query-client';
import { useSessionController } from '@frontend/features/admin-auth/model/use-session-controller';
import {
  response,
  type FakeResponse,
} from '@test/frontend/support/fake-response';
import { mockSession, password } from '@test/frontend/support/mock-session';

function mountSession() {
  const cache = createAppQueryClient();
  const hook = renderHook(useSessionController, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={cache}>{children}</QueryClientProvider>
      </StrictMode>
    ),
  });
  return { ...hook, cache };
}

it('ignores a late bootstrap after logout even if transport ignores abort', async () => {
  const api = mockSession();
  const boot = Promise.withResolvers<FakeResponse>();
  const signals: AbortSignal[] = [];
  api.overrides.set('/api/admin/session', (init) => {
    if (init?.signal) {
      signals.push(init.signal);
    }
    return boot.promise;
  });
  const { result, cache, unmount } = mountSession();
  cache.setQueryData(['protected'], 'secret');
  await act(() => result.current.endSession());
  expect(result.current.authenticated).toBe(false);
  expect(cache.getQueryCache().getAll()).toHaveLength(0);
  await act(async () => {
    boot.resolve(response({ authenticated: true, mode: 'password' }));
    await boot.promise;
  });
  expect(result.current.authenticated).toBe(false);
  unmount();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});

it('does not apply an old expiry notification to a later login', async () => {
  mockSession();
  const { result, cache } = mountSession();
  await waitFor(() => expect(result.current.authenticated).toBe(true));
  const oldEpoch = result.current.epoch;
  await act(() => result.current.endSession());
  await act(() => result.current.authenticate(password, false));
  cache.setQueryData(['new-session-data'], 'new owner');
  act(() => result.current.expireSession(oldEpoch));
  expect(result.current.authenticated).toBe(true);
  expect(cache.getQueryData(['new-session-data'])).toBe('new owner');
});

it('sends one login command for simultaneous submissions', async () => {
  const api = mockSession(false);
  const login = Promise.withResolvers<FakeResponse>();
  api.overrides.set('/api/admin/login', () => login.promise);
  const { result } = mountSession();
  await waitFor(() => expect(result.current.booting).toBe(false));
  let first: Promise<boolean> | undefined;
  act(() => {
    first = result.current.authenticate(password, true);
    void result.current.authenticate(password, true);
  });
  expect(api.commands).toHaveLength(1);
  await act(async () => {
    login.resolve(response({ authenticated: true, mode: 'password' }));
    await first;
  });
  expect(result.current.authenticated).toBe(true);
});
