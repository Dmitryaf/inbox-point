import type { OperatorInboxMessage } from '@frontend-common/entities/operations/model/types';
export function deliveryLabel(message: OperatorInboxMessage): string {
  if (message.deliveryStatus === 'sent') {
    return 'Доставлен';
  }
  if (message.deliveryStatus === 'pending') {
    return 'Готовится к отправке';
  }
  if (message.deliveryStatus === 'failed') {
    return message.deliveryOutcomeUnknown
      ? 'Нужно проверить доставку'
      : 'Не доставлен';
  }
  return '';
}
