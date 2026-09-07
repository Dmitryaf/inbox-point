import { ref } from 'vue';

import {
  pauseOutboundDelivery,
  resumeOutboundDelivery,
} from '@frontend/entities/service-control/api/service-control-api';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

export function useOutboundDeliveryControl(
  refresh: () => Promise<void>,
  onUnauthorized: () => void,
) {
  const error = ref('');
  const notice = ref('');
  const pendingMode = ref<'pause' | 'resume'>();

  async function change(mode: 'pause' | 'resume'): Promise<void> {
    if (mode === 'pause' && !confirmPause()) {
      return;
    }
    pendingMode.value = mode;
    error.value = '';
    notice.value = '';
    try {
      if (mode === 'pause') {
        await pauseOutboundDelivery();
      } else {
        await resumeOutboundDelivery();
      }
      notice.value =
        mode === 'pause'
          ? 'Исходящая доставка остановлена. Очередь сохранена.'
          : 'Исходящая доставка возобновлена.';
      await refresh();
    } catch (cause: unknown) {
      if (cause instanceof HttpError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      error.value = errorMessage(cause);
    } finally {
      pendingMode.value = undefined;
    }
  }

  return { change, error, notice, pendingMode };
}

function confirmPause(): boolean {
  return window.confirm(
    'Остановить доставку ответов? Новые и уже поставленные в очередь ответы не будут отправляться до возобновления.',
  );
}
