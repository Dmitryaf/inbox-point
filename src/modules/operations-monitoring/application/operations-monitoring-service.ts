import type { DeliverySummary } from '@/core/contracts/support-repository.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { ChannelActivitySnapshot } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import {
  channelIsReady,
  channelNeedsAttention,
  mapChannelStatus,
  type ChannelStatusSnapshot,
} from '@/modules/operations-monitoring/application/channel-status.js';
import type { OperationsStatus } from '@/modules/operations-monitoring/model/operations-status.js';

export interface OperationsMonitoringDependencies {
  clock?: () => Date;
  channelActivity: (channel: ClientChannelKind) => ChannelActivitySnapshot;
  deliverySummary: () => DeliverySummary;
  pollStaleAfterMs?: number;
  startedAt: Date;
  telegramStatus: () => ChannelStatusSnapshot;
  vkStatus: () => ChannelStatusSnapshot;
}

export class OperationsMonitoringService {
  private readonly clock: () => Date;
  private readonly pollStaleAfterMs: number;

  public constructor(
    private readonly dependencies: OperationsMonitoringDependencies,
  ) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.pollStaleAfterMs = dependencies.pollStaleAfterMs ?? 120_000;
  }

  public getStatus(): OperationsStatus {
    const observedAt = this.clock();
    const deliveries = this.dependencies.deliverySummary();
    const telegram = mapChannelStatus(
      this.dependencies.telegramStatus(),
      this.dependencies.channelActivity('telegram'),
      observedAt,
      this.dependencies.startedAt,
      this.pollStaleAfterMs,
    );
    const vk = mapChannelStatus(
      this.dependencies.vkStatus(),
      this.dependencies.channelActivity('vk'),
      observedAt,
      this.dependencies.startedAt,
      this.pollStaleAfterMs,
    );
    const needsAttention =
      deliveries.failed > 0 ||
      channelNeedsAttention(telegram) ||
      channelNeedsAttention(vk);

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

  public isReady(): boolean {
    const status = this.getStatus();

    return (
      channelIsReady(status.channels.telegram) &&
      channelIsReady(status.channels.vk)
    );
  }
}
