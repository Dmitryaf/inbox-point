import { ref } from 'vue';

import { resolveInboundEvent } from '@frontend/entities/operations/api/operations-api';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

export function useInboundEventResolution(
  refresh: () => Promise<void>,
  onUnauthorized: () => void,
) {
  const error = ref('');
  const notice = ref('');
  const pendingEventId = ref('');

  async function resolve(
    eventId: string,
    source: string,
    resolution: 'retry' | 'skip',
  ): Promise<void> {
    if (
      resolution === 'skip' &&
      !window.confirm('Пропустить это событие? Оно больше не будет обработано.')
    ) {
      return;
    }
    pendingEventId.value = eventId;
    error.value = '';
    notice.value = '';
    try {
      await resolveInboundEvent(eventId, source, resolution);
      notice.value =
        resolution === 'retry'
          ? 'Повторная обработка началась.'
          : 'Событие пропущено.';
      await refresh();
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, onUnauthorized);
    } finally {
      pendingEventId.value = '';
    }
  }

  return { error, notice, pendingEventId, resolve };
}
