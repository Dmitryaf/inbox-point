import type { ClientChannelKind } from './support-message.js';

export type SupportRequestStatus = 'active' | 'closed';

export interface SupportRequest {
  channel: ClientChannelKind;
  closedAt?: Date;
  conversationId: string;
  createdAt: Date;
  displayName?: string;
  id: string;
  operatorTopicId: string;
  status: SupportRequestStatus;
}

export interface OperatorRequestSummary extends SupportRequest {
  latestMessageAt?: Date;
}

export interface ConversationMessage {
  createdAt: Date;
  deliveryOutcomeUnknown?: boolean;
  deliveryStatus?: 'failed' | 'pending' | 'sent';
  direction: MessageDirection;
  externalMessageId: string;
  id: string;
  requestId: string;
  senderName?: string;
  text: string;
}

export type MessageDirection = 'client_to_operator' | 'operator_to_client';

export interface MessageLink {
  clientMessageId: string;
  createdAt: Date;
  direction: MessageDirection;
  id: string;
  operatorMessageId: string;
  requestId: string;
}

export interface PendingDelivery {
  channel: ClientChannelKind;
  conversationId: string;
  createdAt: Date;
  id: string;
  idempotencyKey: string;
  operatorMessageId: string;
  replyToExternalMessageId?: string;
  requestId: string;
  text: string;
}

export interface QueuedDelivery extends PendingDelivery {
  attempts: number;
}

export interface FailedDelivery {
  attempts: number;
  channel: ClientChannelKind;
  createdAt: Date;
  id: string;
  lastError: string;
  operatorMessageId?: string;
  operatorTopicId: string;
  outcomeUnknown: boolean;
  requestId: string;
}
