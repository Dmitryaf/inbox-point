import { ref } from 'vue';

import { resolveInboundEvent } from '@frontend/entities/operations/api/operations-api';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

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
      !window.confirm(
        'Пропустить событие без обработки? Оно будет удалено из quarantine.',
      )
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
          ? 'Событие возвращено в очередь.'
          : 'Событие пропущено.';
      await refresh();
    } catch (cause: unknown) {
      if (cause instanceof HttpError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      error.value = errorMessage(cause);
    } finally {
      pendingEventId.value = '';
    }
  }

  return { error, notice, pendingEventId, resolve };
}
