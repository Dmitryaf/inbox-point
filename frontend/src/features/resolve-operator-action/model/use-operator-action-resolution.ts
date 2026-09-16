import { ref } from 'vue';

import { resolveOperatorAction } from '@frontend/entities/operations/api/operations-api';
import type { OperatorActionResolution } from '@frontend/entities/operations/model/types';
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
    resolution: OperatorActionResolution,
  ): Promise<void> {
    if (!confirmResolution(resolution)) {
      return;
    }
    pendingActionId.value = actionId;
    error.value = '';
    notice.value = '';
    try {
      await resolveOperatorAction(actionId, resolution);
      notice.value = resolutionNotice(resolution);
      await refresh();
    } catch (cause: unknown) {
      error.value = requestErrorMessage(cause, onUnauthorized);
    } finally {
      pendingActionId.value = '';
    }
  }

  return { error, notice, pendingActionId, resolve };
}

function confirmResolution(resolution: OperatorActionResolution): boolean {
  if (resolution === 'received') {
    return window.confirm(
      'Подтвердить, что всё сообщение видно в Telegram? Автоматического повтора не будет.',
    );
  }
  if (resolution === 'use_web') {
    return window.confirm(
      'Открыть обращение на этой странице? Ответы из прежней темы Telegram больше не будут приниматься.',
    );
  }
  if (resolution === 'retry') {
    return window.confirm(
      'Повторить открытие Telegram-темы? Сохранённый ответ будет отправлен автоматически после успешного открытия.',
    );
  }
  return window.confirm(
    resolution === 'completed'
      ? 'Подтвердить, что состояние темы в Telegram изменилось? Состояние обращения будет синхронизировано.'
      : 'Подтвердить, что состояние темы в Telegram не изменилось? Автоматического повтора не будет.',
  );
}

function resolutionNotice(resolution: OperatorActionResolution): string {
  if (resolution === 'received') {
    return 'Подтверждено: сообщение есть в Telegram.';
  }
  if (resolution === 'use_web') {
    return 'Обращение открыто на этой странице.';
  }
  if (resolution === 'retry') {
    return 'Повторное открытие темы запущено. Сохранённый ответ не нужно отправлять ещё раз.';
  }
  return resolution === 'completed'
    ? 'Состояние обращения синхронизировано с Telegram.'
    : 'Подтверждено: состояние темы не изменилось.';
}
