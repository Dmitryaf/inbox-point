import { request } from '@frontend/shared/api/http-client';

export async function readSession(): Promise<boolean> {
  const session = await request<{ authenticated: boolean }>('/api/ops/session');
  return session.authenticated;
}

export function login(password: string): Promise<unknown> {
  return request('/api/ops/login', {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export function logout(): Promise<unknown> {
  return request('/api/ops/logout', { body: '{}', method: 'POST' });
}
