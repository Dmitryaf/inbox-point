import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';

import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useAdminShellSession();
  const status = ref<SetupStatus>();
  const error = ref('');
  const loading = ref(false);
  let loadVersion = 0;
  watch(
    session.authenticated,
    (authenticated) => {
      status.value = undefined;
      error.value = '';
      loadVersion += 1;
      loading.value = false;
      if (authenticated) {
        void loadStatus();
      }
    },
    { immediate: true },
  );
  async function loadStatus(): Promise<void> {
    const version = ++loadVersion;
    loading.value = true;
    error.value = '';
    try {
      const result = await readSetupStatus();
      if (version === loadVersion) {
        status.value = result;
      }
    } catch (cause: unknown) {
      if (version === loadVersion) {
        error.value = requestErrorMessage(cause, session.expireSession);
      }
    } finally {
      if (version === loadVersion) {
        loading.value = false;
      }
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
  function markTelegramDisconnected(): void {
    if (status.value) {
      status.value.connected = false;
      status.value.locked = false;
      status.value.source = 'none';
    }
  }
  function markVkDisconnected(): void {
    if (status.value) {
      status.value.vk.connected = false;
      status.value.vk.locked = false;
      status.value.vk.source = 'none';
    }
  }
  return {
    session,
    status,
    error,
    loading,
    loadStatus,
    markTelegramConnected,
    markVkConnected,
    markTelegramDisconnected,
    markVkDisconnected,
  };
}
