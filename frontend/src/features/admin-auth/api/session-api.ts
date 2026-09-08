import { request } from '@frontend/shared/api/http-client';

export async function readSession(): Promise<boolean> {
  const session = await request<{ authenticated: boolean }>(
    '/api/admin/session',
  );
  return session.authenticated;
}

export function login(password: string): Promise<unknown> {
  return request('/api/admin/login', {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export function logout(): Promise<unknown> {
  return request('/api/admin/logout', { body: '{}', method: 'POST' });
}
