import type { OperatorRelayIncident } from '@frontend-common/entities/operations/model/types';
export function relayIncident(
  patch: Partial<OperatorRelayIncident> = {},
): OperatorRelayIncident {
  return {
    action: 'relay_message',
    channel: 'Telegram',
    clientMessageId: 'client-message-1',
    confirmable: true,
    createdAt: '2026-09-06T12:00:00Z',
    heldReplyCount: 0,
    id: 'operator:relay-1',
    initial: true,
    operatorTopicId: '900',
    reason: 'Telegram мог принять сообщение клиента.',
    requestId: 'request-1',
    sequence: 1,
    status: 'outcome_unknown',
    ...patch,
  };
}
