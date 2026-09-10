import { onMounted, ref } from 'vue';

import { errorMessage } from '@frontend/shared/lib/error-message';
import {
  login,
  logout,
  readSession,
} from '@frontend/features/admin-auth/api/session-api';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';

export function useAdminSession() {
  const authenticated = ref(false);
  const booting = ref(true);
  const pending = ref(false);
  const error = ref('');

  onMounted(async () => {
    try {
      authenticated.value = await readSession();
    } catch (cause: unknown) {
      error.value = errorMessage(cause);
    } finally {
      booting.value = false;
    }
  });

  const authenticate = async (password: string): Promise<boolean> => {
    pending.value = true;
    error.value = '';
    try {
      await login(password);
      authenticated.value = true;
      return true;
    } catch (cause: unknown) {
      error.value = errorMessage(cause);
      return false;
    } finally {
      pending.value = false;
    }
  };

  const endSession = async (): Promise<void> => {
    error.value = '';
    try {
      await logout();
      authenticated.value = false;
    } catch (cause: unknown) {
      error.value = errorMessage(cause);
    }
  };

  const expireSession = (): void => {
    authenticated.value = false;
    error.value = 'Сессия завершилась. Войдите снова.';
    openAdminLogin(window.location.pathname, error.value);
  };

  return {
    authenticate,
    authenticated,
    booting,
    endSession,
    error,
    expireSession,
    pending,
  };
}
