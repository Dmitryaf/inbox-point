import type { DeliverySummary } from '@/core/contracts/support-repository.js';
import type {
  ChannelConnectionSource,
  ChannelOperationsStatus,
  OperationsStatus,
} from '@/modules/operations-monitoring/model/operations-status.js';

export interface ChannelStatusSnapshot {
  connected: boolean;
  source: ChannelConnectionSource;
}

export interface OperationsMonitoringDependencies {
  clock?: () => Date;
  deliverySummary: () => DeliverySummary;
  startedAt: Date;
  telegramStatus: () => ChannelStatusSnapshot;
  vkStatus: () => ChannelStatusSnapshot;
}

export class OperationsMonitoringService {
  private readonly clock: () => Date;

  public constructor(
    private readonly dependencies: OperationsMonitoringDependencies,
  ) {
    this.clock = dependencies.clock ?? (() => new Date());
  }

  public getStatus(): OperationsStatus {
    const observedAt = this.clock();
    const deliveries = this.dependencies.deliverySummary();
    const telegram = mapChannelStatus(this.dependencies.telegramStatus());
    const vk = mapChannelStatus(this.dependencies.vkStatus());
    const needsAttention =
      deliveries.failed > 0 ||
      isConfiguredButStopped(telegram) ||
      isConfiguredButStopped(vk);

    return {
      channels: { telegram, vk },
      deliveries,
      observedAt: observedAt.toISOString(),
      startedAt: this.dependencies.startedAt.toISOString(),
      state: needsAttention ? 'attention' : 'healthy',
      uptimeSeconds: Math.max(
        0,
        Math.floor(
          (observedAt.getTime() - this.dependencies.startedAt.getTime()) /
            1_000,
        ),
      ),
    };
  }
}

function mapChannelStatus(
  status: ChannelStatusSnapshot,
): ChannelOperationsStatus {
  return {
    configured: status.source !== 'none',
    running: status.connected,
    source: status.source,
  };
}

function isConfiguredButStopped(status: ChannelOperationsStatus): boolean {
  return status.configured && !status.running;
}
