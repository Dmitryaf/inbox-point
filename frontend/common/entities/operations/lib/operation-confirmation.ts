import type { OperatorActionResolution } from '@frontend-common/entities/operations/model/types';

export function operatorConfirmation(
  resolution: OperatorActionResolution,
): string {
  if (resolution === 'received') {
    return 'Подтвердить, что всё сообщение видно в Telegram? Автоматического повтора не будет.';
  }
  if (resolution === 'use_web') {
    return 'Открыть обращение на этой странице? Ответы из прежней темы Telegram больше не будут приниматься.';
  }
  if (resolution === 'retry') {
    return 'Повторить открытие Telegram-темы? Сохранённый ответ будет отправлен автоматически после успешного открытия.';
  }
  return resolution === 'completed'
    ? 'Подтвердить, что состояние темы в Telegram изменилось? Состояние обращения будет синхронизировано.'
    : 'Подтвердить, что состояние темы в Telegram не изменилось? Автоматического повтора не будет.';
}
export function operatorNotice(resolution: OperatorActionResolution): string {
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
