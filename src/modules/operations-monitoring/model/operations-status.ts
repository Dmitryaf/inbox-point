import type { DeliverySummary } from '@/core/contracts/support-repository.js';

export type ChannelConnectionSource = 'environment' | 'local' | 'none';

export interface ChannelOperationsStatus {
  configured: boolean;
  running: boolean;
  source: ChannelConnectionSource;
}

export interface OperationsStatus {
  channels: {
    telegram: ChannelOperationsStatus;
    vk: ChannelOperationsStatus;
  };
  deliveries: DeliverySummary;
  observedAt: string;
  startedAt: string;
  state: 'attention' | 'healthy';
  uptimeSeconds: number;
}
