import { ref } from 'vue';

import { resolveOperatorAction } from '@frontend/entities/operations/api/operations-api';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';

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
          ? 'Подтверждено: сообщение есть в Telegram.'
          : 'Обращение открыто на этой странице.';
      await refresh();
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, onUnauthorized);
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
        'Открыть обращение на этой странице? Ответы из прежней темы Telegram больше не будут приниматься.',
      );
}
