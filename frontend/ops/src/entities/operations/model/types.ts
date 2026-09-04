export type ConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  configured: boolean;
  lastFailedPollAt?: string;
  lastSuccessfulPollAt?: string;
  running: boolean;
  source: ConnectionSource;
  state: 'not_configured' | 'poll_failed' | 'running' | 'stopped';
}

export interface OperationsStatus {
  channels: {
    telegram: ChannelOperationsStatus;
    vk: ChannelOperationsStatus;
  };
  deliveries: {
    failed: number;
    pending: number;
  };
  observedAt: string;
  startedAt: string;
  state: 'attention' | 'healthy';
  uptimeSeconds: number;
}
