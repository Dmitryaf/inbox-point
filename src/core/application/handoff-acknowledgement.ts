import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { SupportRequest } from '@/core/model/support-request.js';

export const handoffAcknowledgement = 'Вопрос отправлен.';
export const handoffDelayedAcknowledgement =
  'Вопрос сохранён. Доставка оператору задерживается.';
export const handoffRecoveredAcknowledgement = 'Вопрос доставлен оператору.';

export type HandoffAcknowledgementKind = 'delayed' | 'recovered' | 'sent';

export function enqueueHandoffAcknowledgement(
  repository: SupportRepository,
  request: Pick<SupportRequest, 'channel' | 'conversationId' | 'id'>,
  createdAt: Date,
  kind: HandoffAcknowledgementKind = 'sent',
): void {
  const deliveryId = `system:handoff-${acknowledgementId(kind)}:${request.id}`;
  repository.enqueueDelivery({
    channel: request.channel,
    conversationId: request.conversationId,
    createdAt,
    id: deliveryId,
    idempotencyKey: deliveryId,
    operatorMessageId: deliveryId,
    requestId: request.id,
    text: acknowledgementText(kind),
  });
}

function acknowledgementId(kind: HandoffAcknowledgementKind): string {
  if (kind === 'sent') {
    return 'ack';
  }
  return kind;
}

function acknowledgementText(kind: HandoffAcknowledgementKind): string {
  if (kind === 'sent') {
    return handoffAcknowledgement;
  }
  if (kind === 'recovered') {
    return handoffRecoveredAcknowledgement;
  }
  return handoffDelayedAcknowledgement;
}
