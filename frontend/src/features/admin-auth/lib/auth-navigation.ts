const returnPathKey = 'inbox-point:return-path';
const loginMessageKey = 'inbox-point:login-message';
const adminPaths = new Set(['/manage', '/ops', '/setup']);

export function rememberAdminLogin(path: string, message?: string): void {
  if (adminPaths.has(path)) {
    window.sessionStorage.setItem(returnPathKey, path);
  }
  if (message) {
    window.sessionStorage.setItem(loginMessageKey, message);
  }
}

export function readLoginDestination(): string {
  const path = window.sessionStorage.getItem(returnPathKey);
  return path && adminPaths.has(path) ? path : '/manage';
}

export function readLoginMessage(): string {
  return window.sessionStorage.getItem(loginMessageKey) ?? '';
}

export function clearLoginMessage(): void {
  window.sessionStorage.removeItem(loginMessageKey);
}

export function clearLoginDestination(): void {
  window.sessionStorage.removeItem(returnPathKey);
}
