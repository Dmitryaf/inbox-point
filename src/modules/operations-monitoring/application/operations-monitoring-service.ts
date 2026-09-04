import type { DeliverySummary } from '@/core/contracts/support-repository.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { ChannelActivitySnapshot } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
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
  channelActivity: (channel: ClientChannelKind) => ChannelActivitySnapshot;
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
    const telegram = mapChannelStatus(
      this.dependencies.telegramStatus(),
      this.dependencies.channelActivity('telegram'),
    );
    const vk = mapChannelStatus(
      this.dependencies.vkStatus(),
      this.dependencies.channelActivity('vk'),
    );
    const needsAttention =
      deliveries.failed > 0 ||
      telegram.state !== 'running' ||
      vk.state !== 'running';

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
  activity: ChannelActivitySnapshot,
): ChannelOperationsStatus {
  return {
    configured: status.source !== 'none',
    ...(activity.lastFailedPollAt
      ? { lastFailedPollAt: activity.lastFailedPollAt.toISOString() }
      : {}),
    ...(activity.lastSuccessfulPollAt
      ? {
          lastSuccessfulPollAt: activity.lastSuccessfulPollAt.toISOString(),
        }
      : {}),
    running: status.connected,
    source: status.source,
    state: resolveChannelState(status, activity),
  };
}

function resolveChannelState(
  status: ChannelStatusSnapshot,
  activity: ChannelActivitySnapshot,
): ChannelOperationsStatus['state'] {
  if (status.source === 'none') {
    return 'not_configured';
  }
  if (
    activity.lastFailedPollAt &&
    (!activity.lastSuccessfulPollAt ||
      activity.lastFailedPollAt > activity.lastSuccessfulPollAt)
  ) {
    return 'poll_failed';
  }
  if (status.connected) {
    return 'running';
  }
  return 'stopped';
}
