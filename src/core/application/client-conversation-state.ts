import type { ClientIntakePolicy } from '@/core/contracts/client-intake-policy.js';
import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { ClientConversationState } from '@/core/model/client-conversation.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

export function resolveClientConversationState(
  repository: SupportRepository,
  intakePolicy: ClientIntakePolicy,
  channel: ClientChannelKind,
  conversationId: string,
  checkedAt: Date,
): ClientConversationState {
  if (repository.findActiveRequest(channel, conversationId)) {
    return {
      intakePaused: intakePolicy.isPaused(channel),
      stage: 'active',
    };
  }
  if (repository.isAwaitingClientQuestion(channel, conversationId, checkedAt)) {
    return {
      intakePaused: intakePolicy.isPaused(channel),
      stage: 'awaiting_question',
    };
  }
  return {
    intakePaused: intakePolicy.isPaused(channel),
    stage: repository.findLatestRequest(channel, conversationId)
      ? 'closed'
      : 'first_contact',
  };
}
