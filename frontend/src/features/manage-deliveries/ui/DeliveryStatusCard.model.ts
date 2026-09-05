import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
} from '@frontend/shared/lib/model-state';
import {
  readDeliveryStatus,
  retryDelivery,
} from '@frontend/entities/setup/api/setup-api';
import type { DeliveryStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const refreshIntervalMs = 10_000;
  const status = ref<DeliveryStatus>();
  const message = ref('');
  const loading = ref(false);
  const retryingId = ref('');
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  const summary = computed(() => {
    if (!status.value) {
      return 'Проверяем состояние доставки…';
    }
    const { failed, pending } = status.value.summary;
    if (failed === 0 && pending === 0) {
      return 'Все ответы доставлены.';
    }
    return `Ожидают отправки: ${pending}. Не доставлено: ${failed}.`;
  });
  onMounted(() => {
    void refresh();
    refreshTimer = setInterval(() => void refresh(), refreshIntervalMs);
  });
  onBeforeUnmount(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  });
  async function refresh(): Promise<void> {
    loading.value = true;
    try {
      status.value = await readDeliveryStatus();
      message.value = '';
    } catch {
      message.value = 'Не удалось проверить доставку. Обновите страницу.';
    } finally {
      loading.value = false;
    }
  }
  async function retry(deliveryId: string): Promise<void> {
    retryingId.value = deliveryId;
    message.value = 'Возвращаем ответ в очередь…';
    try {
      await retryDelivery(deliveryId);
      await refresh();
    } catch (cause: unknown) {
      message.value = errorMessage(cause);
    } finally {
      retryingId.value = '';
    }
  }
  return { status, message, loading, retryingId, summary, refresh, retry };
}
