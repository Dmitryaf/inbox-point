const returnPathKey = 'messenger-handoff:return-path';
const loginMessageKey = 'messenger-handoff:login-message';
const adminPaths = new Set(['/manage', '/ops', '/setup']);

export function openAdminLogin(
  returnPath = window.location.pathname,
  message?: string,
): void {
  if (adminPaths.has(returnPath)) {
    window.sessionStorage.setItem(returnPathKey, returnPath);
  }
  if (message) {
    window.sessionStorage.setItem(loginMessageKey, message);
  }
  replacePath('/login');
}

export function takeAdminLoginMessage(): string {
  const message = window.sessionStorage.getItem(loginMessageKey) ?? '';
  window.sessionStorage.removeItem(loginMessageKey);
  return message;
}

export function leaveAdminLogin(): void {
  const savedPath = window.sessionStorage.getItem(returnPathKey);
  window.sessionStorage.removeItem(returnPathKey);
  replacePath(savedPath && adminPaths.has(savedPath) ? savedPath : '/manage');
}

function replacePath(path: string): void {
  window.history.replaceState(null, '', path);
  window.dispatchEvent(new Event('popstate'));
}
