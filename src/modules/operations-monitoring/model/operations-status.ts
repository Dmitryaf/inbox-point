import type { DeliverySummary } from '@/core/contracts/support-repository.js';

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
  deliveries: DeliverySummary;
  observedAt: string;
  startedAt: string;
  state: 'attention' | 'healthy';
  uptimeSeconds: number;
}
