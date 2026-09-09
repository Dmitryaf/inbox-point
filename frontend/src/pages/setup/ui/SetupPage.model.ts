import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';

import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

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
  async function loadStatus(): Promise<void> {
    try {
      status.value = await readSetupStatus();
    } catch (cause: unknown) {
      if (cause instanceof HttpError && cause.status === 401) {
        session.expireSession();
        return;
      }
      error.value = errorMessage(cause);
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
  return { session, status, error, markTelegramConnected, markVkConnected };
}
