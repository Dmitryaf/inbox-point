import { ref } from 'vue';

import {
  resolveOperationsDelivery,
  retryOperationsDelivery,
} from '@frontend/entities/operations/api/operations-api';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export function useDeliveryRetry(
  refresh: () => Promise<void>,
  onUnauthorized: () => void,
) {
  const error = ref('');
  const notice = ref('');
  const pendingDeliveryId = ref('');

  async function retry(deliveryId: string): Promise<void> {
    if (!window.confirm('Отправить этот ответ ещё раз?')) {
      return;
    }
    await execute(
      deliveryId,
      () => retryOperationsDelivery(deliveryId),
      'Повторная отправка началась.',
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
        : 'Повторная отправка началась.',
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
      error.value = requestErrorMessage(cause, onUnauthorized);
    } finally {
      pendingDeliveryId.value = '';
    }
  }

  return { error, notice, pendingDeliveryId, resolve, retry };
}

function confirmResolution(resolution: 'not_received' | 'received'): boolean {
  return resolution === 'received'
    ? window.confirm(
        'Подтвердить, что клиент получил сообщение? Повторной отправки не будет.',
      )
    : window.confirm(
        'Подтвердить, что сообщение не получено, и отправить его повторно?',
      );
}
