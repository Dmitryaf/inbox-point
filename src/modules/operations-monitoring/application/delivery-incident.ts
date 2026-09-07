import type { FailedDelivery } from '@/core/model/support-request.js';
import type { DeliveryIncident } from '@/modules/operations-monitoring/model/operations-status.js';

export function mapDeliveryIncident(
  delivery: FailedDelivery,
): DeliveryIncident {
  return {
    attempts: delivery.attempts,
    channel: delivery.channel === 'telegram' ? 'Telegram' : 'VK',
    createdAt: delivery.createdAt.toISOString(),
    id: delivery.id,
    ...(delivery.operatorMessageId
      ? { operatorMessageId: delivery.operatorMessageId }
      : {}),
    operatorTopicId: delivery.operatorTopicId,
    outcomeUnknown: delivery.outcomeUnknown,
    reason: delivery.outcomeUnknown
      ? 'Канал мог принять ответ, но подтверждение не получено. Автоматический повтор отключён, чтобы не отправить дубликат.'
      : explainDeliveryFailure(delivery.lastError, delivery.channel),
    requestId: delivery.requestId,
    retryAllowed: !delivery.outcomeUnknown,
  };
}

function explainDeliveryFailure(
  error: string,
  channel: FailedDelivery['channel'],
): string {
  const normalized = error.toLowerCase();
  if (
    normalized.includes('blocked') ||
    normalized.includes('chat not found') ||
    normalized.includes('user is deactivated') ||
    normalized.includes('forbidden')
  ) {
    return 'Бот не может отправить ответ. Возможно, пользователь заблокировал бота.';
  }
  if (
    normalized.includes('unauthorized') ||
    normalized.includes('invalid token')
  ) {
    return channel === 'telegram'
      ? 'Telegram не принимает подключение бота. Переподключите Telegram.'
      : 'VK не принимает ключ сообщества. Переподключите VK.';
  }
  if (normalized.includes('too many requests') || normalized.includes('429')) {
    return 'Канал временно ограничил отправку. Повторите попытку позже.';
  }
  if (
    normalized.includes('request failed') ||
    normalized.includes('network') ||
    normalized.includes('timeout') ||
    normalized.includes('econn')
  ) {
    return 'Не удалось связаться с каналом. Проверьте интернет и повторите попытку.';
  }
  return channel === 'telegram'
    ? 'Telegram не доставил ответ. Проверьте подключение и повторите попытку.'
    : 'VK не доставил ответ. Проверьте подключение и повторите попытку.';
}
