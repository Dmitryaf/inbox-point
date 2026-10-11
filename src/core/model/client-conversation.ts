export type ClientConversationStage =
  'active' | 'awaiting_question' | 'closed' | 'first_contact';

export const awaitingClientQuestionTtlMs = 2 * 60 * 60 * 1_000;

export interface ClientConversationState {
  awaitingQuestion?: boolean;
  intakePaused: boolean;
  stage: ClientConversationStage;
}
