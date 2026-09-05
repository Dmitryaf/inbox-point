import type {
  DeliverySummary,
  SupportRepository,
} from '@/core/contracts/support-repository.js';
import type { FailedDelivery } from '@/core/model/support-request.js';

export interface PublicDeliveryFailure {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  reason: string;
  retryAllowed: boolean;
}

export interface PublicDeliveryStatus {
  failures: readonly PublicDeliveryFailure[];
  summary: DeliverySummary;
}

export function createPublicDeliveryStatus(
  deliveries:
    | Pick<SupportRepository, 'findFailedDeliveries' | 'getDeliverySummary'>
    | undefined,
): PublicDeliveryStatus {
  if (!deliveries) {
    return {
      failures: [],
      summary: { failed: 0, pending: 0 },
    };
  }
  return {
    failures: deliveries.findFailedDeliveries(20).map(mapDeliveryFailure),
    summary: deliveries.getDeliverySummary(),
  };
}

export function mapDeliveryFailure(
  delivery: FailedDelivery,
): PublicDeliveryFailure {
  return {
    attempts: delivery.attempts,
    channel: delivery.channel === 'telegram' ? 'Telegram' : 'VK',
    createdAt: delivery.createdAt.toISOString(),
    id: delivery.id,
    reason: delivery.outcomeUnknown
      ? 'Канал мог принять ответ, но подтверждение не получено. Проверьте диалог клиента вручную: автоматический повтор отключён, чтобы не отправить дубликат.'
      : explainDeliveryFailure(delivery.lastError, delivery.channel),
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
    return 'Бот не может написать клиенту. Возможно, клиент заблокировал бота.';
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
