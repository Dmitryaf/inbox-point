export type ChannelConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  configured: boolean;
  lastFailedPollAt?: string;
  lastSuccessfulPollAt?: string;
  running: boolean;
  source: ChannelConnectionSource;
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
  deliveries: DeliveryOperationsStatus;
  intake: {
    telegram: ClientIntakeOperationsStatus;
    vk: ClientIntakeOperationsStatus;
  };
  inboundEvents: InboundEventOperationsStatus;
  observedAt: string;
  operatorRelays: OperatorRelayOperationsStatus;
  outbound: OutboundDeliveryOperationsStatus;
  startedAt: string;
  state: 'attention' | 'healthy' | 'maintenance';
  uptimeSeconds: number;
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
