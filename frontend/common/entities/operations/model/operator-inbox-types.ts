export interface OperatorInboxRequest {
  channel: 'telegram' | 'vk';
  createdAt: string;
  displayName?: string;
  id: string;
  latestMessageAt?: string;
  status: 'active' | 'closed';
}

export interface OperatorInboxMessage {
  createdAt: string;
  deliveryOutcomeUnknown?: boolean;
  deliveryStatus?: 'failed' | 'pending' | 'sent';
  direction: 'client_to_operator' | 'operator_to_client';
  id: string;
  senderName?: string;
  text: string;
}
