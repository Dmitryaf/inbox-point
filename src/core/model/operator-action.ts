import type { ClientChannelKind } from './support-message.js';

export type OperatorActionKind =
  'close_request' | 'open_request' | 'relay_message' | 'reopen_request';
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
  heldReplyCount: number;
  lastError: string;
}

export interface OperatorActionSummary {
  uncertain: number;
}

export function createOperatorLifecycleAction(
  kind: 'close_request' | 'reopen_request',
  operatorTopicId: string,
  options: { externalEventId: string; requestId: string },
  createdAt: Date,
): PendingOperatorAction {
  const operation = kind === 'close_request' ? 'close' : 'reopen';
  return {
    clientMessageId: options.externalEventId,
    createdAt,
    id: `operator-${operation}:${options.requestId}:${options.externalEventId}`,
    initial: false,
    kind,
    operatorTopicId,
    requestId: options.requestId,
    sequence: 0,
  };
}
