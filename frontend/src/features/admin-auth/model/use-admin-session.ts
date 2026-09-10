import { onMounted, ref } from 'vue';

import { errorMessage } from '@frontend/shared/lib/error-message';
import {
  login,
  logout,
  readSession,
  type AdminSessionMode,
} from '@frontend/features/admin-auth/api/session-api';

export type AdminSession = ReturnType<typeof useAdminSession>;

export function useAdminSession() {
  const authenticated = ref(false);
  const booting = ref(true);
  const pending = ref(false);
  const error = ref('');
  const mode = ref<AdminSessionMode>();

  onMounted(async () => {
    try {
      const session = await readSession();
      authenticated.value = session.authenticated;
      mode.value = session.mode;
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
      const session = await login(password);
      authenticated.value = session.authenticated;
      mode.value = session.mode;
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
      const session = await logout();
      authenticated.value = session.authenticated;
      mode.value = session.mode;
    } catch (cause: unknown) {
      error.value = errorMessage(cause);
    }
  };

  const expireSession = (): void => {
    authenticated.value = false;
    error.value = 'Сессия завершилась. Войдите снова.';
  };

  return {
    authenticate,
    authenticated,
    booting,
    endSession,
    error,
    expireSession,
    mode,
    pending,
  };
}
