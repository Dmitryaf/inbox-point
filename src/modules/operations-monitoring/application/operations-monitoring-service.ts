import type { DeliverySummary } from '@/core/contracts/support-repository.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { ChannelActivitySnapshot } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import type { DeliveryWorkerActivitySnapshot } from '@/modules/operations-monitoring/application/delivery-worker-activity-monitor.js';
import { mapDeliveryStatus } from '@/modules/operations-monitoring/application/delivery-status.js';
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
  deliveryActivity: () => DeliveryWorkerActivitySnapshot;
  deliverySummary: () => DeliverySummary;
  pendingDeliveryStaleAfterMs?: number;
  pollStaleAfterMs?: number;
  startedAt: Date;
  telegramStatus: () => ChannelStatusSnapshot;
  vkStatus: () => ChannelStatusSnapshot;
}

export class OperationsMonitoringService {
  private readonly clock: () => Date;
  private readonly pendingDeliveryStaleAfterMs: number;
  private readonly pollStaleAfterMs: number;

  public constructor(
    private readonly dependencies: OperationsMonitoringDependencies,
  ) {
    this.clock = dependencies.clock ?? (() => new Date());
    this.pendingDeliveryStaleAfterMs =
      dependencies.pendingDeliveryStaleAfterMs ?? 300_000;
    this.pollStaleAfterMs = dependencies.pollStaleAfterMs ?? 120_000;
  }

  public getStatus(): OperationsStatus {
    const observedAt = this.clock();
    const deliveries = mapDeliveryStatus(
      this.dependencies.deliverySummary(),
      this.dependencies.deliveryActivity(),
      observedAt,
      this.pendingDeliveryStaleAfterMs,
    );
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
      deliveries.state !== 'healthy' ||
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
      status.deliveries.state !== 'backlog' &&
      status.deliveries.state !== 'stalled' &&
      channelIsReady(status.channels.telegram) &&
      channelIsReady(status.channels.vk)
    );
  }
}
