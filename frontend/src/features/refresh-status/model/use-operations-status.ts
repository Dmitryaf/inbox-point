import { ref } from '@frontend/shared/lib/model-state';

import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';
import { readOperationsStatus } from '@frontend/entities/operations/api/operations-api';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';

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
      if (cause instanceof HttpError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      error.value = errorMessage(cause);
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
