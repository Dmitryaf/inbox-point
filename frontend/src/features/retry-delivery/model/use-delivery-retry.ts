import { ref } from 'vue';

import { retryOperationsDelivery } from '@frontend/entities/operations/api/operations-api';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

export function useDeliveryRetry(
  refresh: () => Promise<void>,
  onUnauthorized: () => void,
) {
  const error = ref('');
  const notice = ref('');
  const pendingDeliveryId = ref('');

  async function retry(deliveryId: string): Promise<void> {
    if (
      !window.confirm(
        'Повторно отправить этот ответ клиенту? Действие поставит сообщение в очередь доставки.',
      )
    ) {
      return;
    }
    pendingDeliveryId.value = deliveryId;
    error.value = '';
    notice.value = '';
    try {
      await retryOperationsDelivery(deliveryId);
      notice.value = 'Ответ поставлен в очередь повторной доставки.';
      await refresh();
    } catch (cause: unknown) {
      if (cause instanceof HttpError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      error.value = errorMessage(cause);
    } finally {
      pendingDeliveryId.value = '';
    }
  }

  return { error, notice, pendingDeliveryId, retry };
}
