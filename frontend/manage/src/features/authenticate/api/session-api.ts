import { request } from '@frontend/shared/api/http-client';

export async function readSession(): Promise<boolean> {
  const session = await request<{ authenticated: boolean }>(
    '/api/manage/session',
  );
  return session.authenticated;
}

export function login(password: string): Promise<unknown> {
  return request('/api/manage/login', {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export function logout(): Promise<unknown> {
  return request('/api/manage/logout', { body: '{}', method: 'POST' });
}
