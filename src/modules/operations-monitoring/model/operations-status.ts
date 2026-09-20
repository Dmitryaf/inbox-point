export type ChannelConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  configured: boolean;
  lastFailedPollAt?: string;
  lastSuccessfulPollAt?: string;
  running: boolean;
  source: ChannelConnectionSource;
  state:
    | 'configuration_missing'
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
  deliveries: DeliveryOperationsStatus;
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
  channel: 'Telegram' | 'VK';
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

export interface OperatorRelayIncident {
  action:
    | 'close_request'
    | 'mirror_operator_message'
    | 'open_request'
    | 'relay_message'
    | 'reopen_request';
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
    | 'abandoned'
    | 'failed'
    | 'outcome_unknown'
    | 'pending'
    | 'sending'
    | 'sent'
    | 'superseded';
}

export interface OutboundDeliveryOperationsStatus {
  changedAt?: string;
  mode: 'active' | 'paused';
}

export interface ClientIntakeOperationsStatus {
  changedAt?: string;
  mode: 'active' | 'paused';
}

export interface DeliveryOperationsStatus {
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
