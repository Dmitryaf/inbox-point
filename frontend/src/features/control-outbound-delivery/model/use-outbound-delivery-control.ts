import { ref } from 'vue';

import {
  pauseOutboundDelivery,
  resumeOutboundDelivery,
} from '@frontend/entities/service-control/api/service-control-api';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

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
          ? 'Ответы клиентам приостановлены. Сохранённые ответы не потеряны.'
          : 'Ответы клиентам возобновлены.';
      await refresh();
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, onUnauthorized);
    } finally {
      pendingMode.value = undefined;
    }
  }

  return { change, error, notice, pendingMode };
}

function confirmPause(): boolean {
  return window.confirm(
    'Приостановить ответы клиентам? Новые и ещё не отправленные ответы сохранятся до возобновления.',
  );
}
