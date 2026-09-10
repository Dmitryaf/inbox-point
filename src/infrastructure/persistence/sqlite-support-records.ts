import type {
  OperatorAction,
  OperatorActionIncident,
  OperatorActionKind,
  OperatorActionStatus,
  PendingOperatorAction,
} from '@/core/model/operator-action.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type {
  ConversationMessage,
  SupportRequest,
  SupportRequestStatus,
} from '@/core/model/support-request.js';

export interface SupportRequestRow {
  channel: ClientChannelKind;
  client_display_name: string | null;
  closed_at: string | null;
  created_at: string;
  external_conversation_id: string;
  id: string;
  operator_topic_id: string;
  status: SupportRequestStatus;
}

export interface OperatorRequestSummaryRow extends SupportRequestRow {
  latest_message_at: string | null;
}

export interface ConversationMessageRow {
  created_at: string;
  delivery_outcome_unknown: number | null;
  delivery_status: 'failed' | 'pending' | 'sent' | null;
  direction: ConversationMessage['direction'];
  external_message_id: string;
  id: string;
  request_id: string;
  sender_name: string | null;
  text: string;
}

export interface DeliveryRow {
  attempts: number;
  channel: ClientChannelKind;
  created_at: string;
  external_conversation_id: string;
  id: string;
  idempotency_key: string;
  operator_message_id: string | null;
  reply_to_external_message_id: string | null;
  request_id: string;
  text: string;
}

export interface FailedDeliveryRow {
  attempts: number;
  channel: ClientChannelKind;
  created_at: string;
  id: string;
  last_error: string | null;
  operator_message_id: string | null;
  operator_topic_id: string;
  outcome_unknown: number;
  request_id: string;
}

export interface OperatorActionRow {
  client_message_id: string;
  created_at: string;
  external_result_id: string | null;
  id: string;
  initial: number;
  kind: OperatorActionKind;
  last_error: string | null;
  operator_topic_id: string;
  request_id: string;
  sequence: number;
  status: OperatorActionStatus;
}

export interface OperatorActionIncidentRow extends OperatorActionRow {
  channel: ClientChannelKind;
  confirmable: number;
  external_conversation_id: string;
}

export function mapRequest(row: SupportRequestRow): SupportRequest {
  return {
    channel: row.channel,
    ...(row.closed_at ? { closedAt: new Date(row.closed_at) } : {}),
    conversationId: row.external_conversation_id,
    createdAt: new Date(row.created_at),
    ...(row.client_display_name
      ? { displayName: row.client_display_name }
      : {}),
    id: row.id,
    operatorTopicId: row.operator_topic_id,
    status: row.status,
  };
}

export function mapOperatorAction(row: OperatorActionRow): OperatorAction {
  return {
    clientMessageId: row.client_message_id,
    createdAt: new Date(row.created_at),
    ...(row.external_result_id
      ? { externalResultId: row.external_result_id }
      : {}),
    id: row.id,
    initial: row.initial === 1,
    kind: row.kind,
    operatorTopicId: row.operator_topic_id,
    requestId: row.request_id,
    sequence: row.sequence,
    status: row.status,
  };
}

export function mapOperatorActionIncident(
  row: OperatorActionIncidentRow,
): OperatorActionIncident {
  return {
    ...mapOperatorAction(row),
    channel: row.channel,
    confirmable: row.confirmable === 1,
    conversationId: row.external_conversation_id,
    lastError: row.last_error ?? 'Unknown operator action error',
  };
}

export function operatorActionMatches(
  row: OperatorActionRow,
  action: PendingOperatorAction,
): boolean {
  return (
    row.request_id === action.requestId &&
    row.kind === action.kind &&
    row.client_message_id === action.clientMessageId &&
    row.operator_topic_id === action.operatorTopicId &&
    row.sequence === action.sequence
  );
}
