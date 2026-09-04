export type ConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  configured: boolean;
  running: boolean;
  source: ConnectionSource;
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
