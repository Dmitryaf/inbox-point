import { ref } from 'vue';

import { readOperationsStatus } from '@frontend/entities/operations/api/operations-api';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export function useOperationsStatus(onUnauthorized: () => void) {
  const error = ref('');
  const loading = ref(false);
  const status = ref<OperationsStatus>();

  const refresh = async (): Promise<void> => {
    loading.value = true;
    error.value = '';
    try {
      status.value = await readOperationsStatus();
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, onUnauthorized);
    } finally {
      loading.value = false;
    }
  };

  const clear = (): void => {
    status.value = undefined;
    error.value = '';
  };

  return { clear, error, loading, refresh, status };
}
