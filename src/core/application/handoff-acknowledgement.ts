import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { SupportRequest } from '@/core/model/support-request.js';

import { clientMessages } from './client-messages.js';

export const handoffAcknowledgement = clientMessages.handoffSent;
export const handoffDelayedAcknowledgement = clientMessages.handoffDelayed;
export const handoffRecoveredAcknowledgement = clientMessages.handoffSent;

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
