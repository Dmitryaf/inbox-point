import type { ClientChannelKind } from './support-message.js';

export type OperatorActionKind = 'open_request' | 'relay_message';
export type OperatorActionStatus =
  'abandoned' | 'failed' | 'outcome_unknown' | 'pending' | 'sending' | 'sent';

export interface PendingOperatorAction {
  clientMessageId: string;
  createdAt: Date;
  id: string;
  initial: boolean;
  kind: OperatorActionKind;
  operatorTopicId: string;
  requestId: string;
  sequence: number;
}

export interface OperatorAction extends PendingOperatorAction {
  externalResultId?: string;
  status: OperatorActionStatus;
}

export interface OperatorActionIncident extends OperatorAction {
  channel: ClientChannelKind;
  confirmable: boolean;
  conversationId: string;
  lastError: string;
}

export interface OperatorActionSummary {
  uncertain: number;
}
