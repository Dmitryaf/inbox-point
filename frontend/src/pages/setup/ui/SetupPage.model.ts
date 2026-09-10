import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';

import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useAdminSession();
  const status = ref<SetupStatus>();
  const error = ref('');
  watch(session.authenticated, (authenticated) => {
    status.value = undefined;
    error.value = '';
    if (authenticated) {
      void loadStatus();
    }
  });
  watch(
    [session.booting, session.authenticated],
    ([booting, authenticated]) => {
      if (!booting && !authenticated) {
        openAdminLogin('/setup');
      }
    },
    { immediate: true },
  );
  async function logOut(): Promise<void> {
    await session.endSession();
  }
  async function loadStatus(): Promise<void> {
    try {
      status.value = await readSetupStatus();
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, session.expireSession);
    }
  }
  function markTelegramConnected(): void {
    if (status.value) {
      status.value.connected = true;
      status.value.locked = true;
      status.value.source = 'local';
    }
  }
  function markVkConnected(): void {
    if (status.value) {
      status.value.vk.connected = true;
      status.value.vk.locked = true;
      status.value.vk.source = 'local';
    }
  }
  return {
    session,
    status,
    error,
    logOut,
    markTelegramConnected,
    markVkConnected,
  };
}
