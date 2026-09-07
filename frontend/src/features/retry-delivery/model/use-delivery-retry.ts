import { ref } from 'vue';

import {
  resolveOperationsDelivery,
  retryOperationsDelivery,
} from '@frontend/entities/operations/api/operations-api';
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
        'Повторно отправить этот ответ? Действие поставит сообщение в очередь доставки.',
      )
    ) {
      return;
    }
    await execute(
      deliveryId,
      () => retryOperationsDelivery(deliveryId),
      'Ответ поставлен в очередь повторной доставки.',
    );
  }

  async function resolve(
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ): Promise<void> {
    if (!confirmResolution(resolution)) {
      return;
    }
    await execute(
      deliveryId,
      () => resolveOperationsDelivery(deliveryId, resolution),
      resolution === 'received'
        ? 'Получение сообщения подтверждено.'
        : 'Неполученный ответ поставлен в очередь повторной доставки.',
    );
  }

  async function execute(
    deliveryId: string,
    action: () => Promise<void>,
    successNotice: string,
  ): Promise<void> {
    pendingDeliveryId.value = deliveryId;
    error.value = '';
    notice.value = '';
    try {
      await action();
      notice.value = successNotice;
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

  return { error, notice, pendingDeliveryId, resolve, retry };
}

function confirmResolution(resolution: 'not_received' | 'received'): boolean {
  return resolution === 'received'
    ? window.confirm(
        'Подтвердить, что сообщение получено? Инцидент будет закрыт без повторной отправки.',
      )
    : window.confirm(
        'Подтвердить, что сообщение не получено, и отправить его повторно?',
      );
}
