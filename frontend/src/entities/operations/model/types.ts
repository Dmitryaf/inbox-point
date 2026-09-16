export type ConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  configured: boolean;
  lastFailedPollAt?: string;
  lastSuccessfulPollAt?: string;
  running: boolean;
  source: ConnectionSource;
  state:
    | 'not_configured'
    | 'poll_failed'
    | 'poll_stale'
    | 'running'
    | 'starting'
    | 'stopped';
}

export interface OperationsStatus {
  channels: {
    telegram: ChannelOperationsStatus;
    vk: ChannelOperationsStatus;
  };
  deliveries: {
    failed: number;
    incidents: readonly DeliveryIncident[];
    oldestPendingAgeSeconds?: number;
    oldestPendingAt?: string;
    pending: number;
    state: 'backlog' | 'failed' | 'healthy' | 'paused' | 'stalled';
    uncertain: number;
    worker: {
      lastCycleAt?: string;
      running: boolean;
      state: 'inactive' | 'running' | 'stalled';
    };
  };
  intake: {
    telegram: ClientIntakeOperationsStatus;
    vk: ClientIntakeOperationsStatus;
  };
  inboundEvents: InboundEventOperationsStatus;
  observedAt: string;
  operatorInbox: OperatorInboxOperationsStatus;
  operatorRelays: OperatorRelayOperationsStatus;
  outbound: OutboundDeliveryOperationsStatus;
  startedAt: string;
  state: 'attention' | 'healthy' | 'maintenance';
  uptimeSeconds: number;
}

export interface OperatorInboxOperationsStatus {
  recoverableWebRequests: number;
  state: 'attention' | 'healthy';
  webOwnedRequests: number;
}

export interface InboundEventOperationsStatus {
  incidents: readonly InboundEventIncident[];
  quarantined: number;
  state: 'healthy' | 'quarantined';
}

export interface InboundEventIncident {
  attempts: number;
  channel: 'VK';
  eventId: string;
  reason: string;
  receivedAt: string;
  source: string;
}

export interface OperatorRelayOperationsStatus {
  incidents: readonly OperatorRelayIncident[];
  state: 'healthy' | 'uncertain';
  uncertain: number;
}

export type OperatorActionResolution =
  'completed' | 'not_completed' | 'received' | 'retry' | 'use_web';

export interface OperatorRelayIncident {
  action: 'close_request' | 'open_request' | 'relay_message' | 'reopen_request';
  channel: 'Telegram' | 'VK';
  clientMessageId: string;
  confirmable: boolean;
  createdAt: string;
  heldReplyCount: number;
  id: string;
  initial: boolean;
  operatorTopicId: string;
  reason: string;
  requestId: string;
  sequence: number;
  status:
    'abandoned' | 'failed' | 'outcome_unknown' | 'pending' | 'sending' | 'sent';
}

export interface OutboundDeliveryOperationsStatus {
  changedAt?: string;
  mode: 'active' | 'paused';
}

export interface DeliveryIncident {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  operatorMessageId?: string;
  operatorTopicId: string;
  outcomeUnknown: boolean;
  reason: string;
  requestId: string;
  retryAllowed: boolean;
}

export interface ClientIntakeOperationsStatus {
  changedAt?: string;
  mode: 'active' | 'paused';
}

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
