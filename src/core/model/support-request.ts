import type { ClientChannelKind } from './support-message.js';

export type SupportRequestStatus = 'active' | 'closed';

export interface SupportRequest {
  channel: ClientChannelKind;
  closedAt?: Date;
  conversationId: string;
  createdAt: Date;
  id: string;
  operatorTopicId: string;
  status: SupportRequestStatus;
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
  replyToExternalMessageId?: string;
  requestId: string;
  text: string;
}
