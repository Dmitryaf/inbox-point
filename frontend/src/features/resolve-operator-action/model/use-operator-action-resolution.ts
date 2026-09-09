import { ref } from 'vue';

import { resolveOperatorAction } from '@frontend/entities/operations/api/operations-api';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

export function useOperatorActionResolution(
  refresh: () => Promise<void>,
  onUnauthorized: () => void,
) {
  const error = ref('');
  const notice = ref('');
  const pendingActionId = ref('');

  async function resolve(
    actionId: string,
    resolution: 'received' | 'use_web',
  ): Promise<void> {
    if (!confirmResolution(resolution)) {
      return;
    }
    pendingActionId.value = actionId;
    error.value = '';
    notice.value = '';
    try {
      await resolveOperatorAction(actionId, resolution);
      notice.value =
        resolution === 'received'
          ? 'Получение сообщения оператором подтверждено.'
          : 'Обращение переведено в web inbox.';
      await refresh();
    } catch (cause: unknown) {
      if (cause instanceof HttpError && cause.status === 401) {
        onUnauthorized();
        return;
      }
      error.value = errorMessage(cause);
    } finally {
      pendingActionId.value = '';
    }
  }

  return { error, notice, pendingActionId, resolve };
}

function confirmResolution(resolution: 'received' | 'use_web'): boolean {
  return resolution === 'received'
    ? window.confirm(
        'Подтвердить, что всё сообщение видно в Telegram? Автоматического повтора не будет.',
      )
    : window.confirm(
        'Перевести обращение в web inbox? Ответы из прежней Telegram-темы больше не будут маршрутизироваться.',
      );
}
