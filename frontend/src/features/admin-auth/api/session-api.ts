import { request } from '@frontend/shared/api/http-client';

export type AdminSessionMode = 'bypass' | 'password';

export interface AdminSessionSnapshot {
  authenticated: boolean;
  mode: AdminSessionMode;
}

export async function readSession(): Promise<AdminSessionSnapshot> {
  return request<AdminSessionSnapshot>('/api/admin/session');
}

export function login(
  password: string,
  rememberDevice: boolean,
): Promise<AdminSessionSnapshot> {
  return request<AdminSessionSnapshot>('/api/admin/login', {
    body: JSON.stringify({ password, rememberDevice }),
    method: 'POST',
  });
}

export function logout(): Promise<AdminSessionSnapshot> {
  return request<AdminSessionSnapshot>('/api/admin/logout', {
    body: '{}',
    method: 'POST',
  });
}

export function revokeAllSessions(): Promise<AdminSessionSnapshot> {
  return request<AdminSessionSnapshot>('/api/admin/sessions/revoke-all', {
    body: '{}',
    method: 'POST',
  });
}
