import { ref } from 'vue';

import { readOperationsStatus } from '@frontend/entities/operations/api/operations-api';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export function useOperationsStatus(onUnauthorized: () => void) {
  const error = ref('');
  const loading = ref(false);
  const status = ref<OperationsStatus>();

  const refresh = async (): Promise<string> => {
    loading.value = true;
    error.value = '';
    try {
      status.value = await readOperationsStatus();
      return '';
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, onUnauthorized);
      return error.value;
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
