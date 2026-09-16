export type ClientConversationStage =
  'active' | 'awaiting_question' | 'closed' | 'first_contact';

export interface ClientConversationState {
  intakePaused: boolean;
  stage: ClientConversationStage;
}
