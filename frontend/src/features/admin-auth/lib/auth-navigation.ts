const returnPathKey = 'messenger-handoff:return-path';
const loginMessageKey = 'messenger-handoff:login-message';
const adminPaths = new Set(['/manage', '/ops', '/setup']);

export function openAdminLogin(
  router: Router,
  returnPath = window.location.pathname,
  message?: string,
): void {
  if (adminPaths.has(returnPath)) {
    window.sessionStorage.setItem(returnPathKey, returnPath);
  }
  if (message) {
    window.sessionStorage.setItem(loginMessageKey, message);
  }
  void router.replace('/login');
}

export function takeAdminLoginMessage(): string {
  const message = window.sessionStorage.getItem(loginMessageKey) ?? '';
  window.sessionStorage.removeItem(loginMessageKey);
  return message;
}

export function leaveAdminLogin(router: Router): void {
  const savedPath = window.sessionStorage.getItem(returnPathKey);
  window.sessionStorage.removeItem(returnPathKey);
  void router.replace(
    savedPath && adminPaths.has(savedPath) ? savedPath : '/manage',
  );
}
import type { Router } from 'vue-router';
