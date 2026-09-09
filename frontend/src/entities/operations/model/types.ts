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
  observedAt: string;
  operatorRelays: OperatorRelayOperationsStatus;
  outbound: OutboundDeliveryOperationsStatus;
  startedAt: string;
  state: 'attention' | 'healthy' | 'maintenance';
  uptimeSeconds: number;
}

export interface OperatorRelayOperationsStatus {
  incidents: readonly OperatorRelayIncident[];
  state: 'healthy' | 'uncertain';
  uncertain: number;
}

export interface OperatorRelayIncident {
  action: 'open_request' | 'relay_message';
  channel: 'Telegram' | 'VK';
  clientMessageId: string;
  confirmable: boolean;
  createdAt: string;
  id: string;
  initial: boolean;
  operatorTopicId: string;
  reason: string;
  requestId: string;
  sequence: number;
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
