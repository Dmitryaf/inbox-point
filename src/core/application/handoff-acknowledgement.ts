import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { SupportRequest } from '@/core/model/support-request.js';

export const handoffAcknowledgement = 'Вопрос отправлен. Ответ появится здесь.';

export function enqueueHandoffAcknowledgement(
  repository: SupportRepository,
  request: Pick<SupportRequest, 'channel' | 'conversationId' | 'id'>,
  createdAt: Date,
): void {
  const deliveryId = `system:handoff-ack:${request.id}`;
  repository.enqueueDelivery({
    channel: request.channel,
    conversationId: request.conversationId,
    createdAt,
    id: deliveryId,
    idempotencyKey: deliveryId,
    operatorMessageId: deliveryId,
    requestId: request.id,
    text: handoffAcknowledgement,
  });
}
