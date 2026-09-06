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
  observedAt: string;
  outbound: OutboundDeliveryOperationsStatus;
  startedAt: string;
  state: 'attention' | 'healthy' | 'maintenance';
  uptimeSeconds: number;
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
