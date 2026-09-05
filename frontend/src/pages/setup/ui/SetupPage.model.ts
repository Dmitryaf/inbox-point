import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { onMounted, ref } from '@frontend/shared/lib/model-state';
import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';

import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const status = ref<SetupStatus>();
  const error = ref('');
  onMounted(async () => {
    try {
      status.value = await readSetupStatus();
    } catch (cause: unknown) {
      error.value = errorMessage(cause);
    }
  });
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
  return { status, error, markTelegramConnected, markVkConnected };
}
