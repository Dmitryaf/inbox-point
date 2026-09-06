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
    state: 'backlog' | 'failed' | 'healthy' | 'stalled';
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
  startedAt: string;
  state: 'attention' | 'healthy' | 'maintenance';
  uptimeSeconds: number;
}

export interface DeliveryIncident {
  attempts: number;
  channel: 'Telegram' | 'VK';
  createdAt: string;
  id: string;
  operatorMessageId?: string;
  operatorTopicId: string;
  reason: string;
  requestId: string;
  retryAllowed: boolean;
}

export interface ClientIntakeOperationsStatus {
  changedAt?: string;
  mode: 'active' | 'paused';
}
