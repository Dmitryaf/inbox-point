import type {
  ChannelActivityReporter,
  ChannelFailureDiagnostic,
} from '@/core/contracts/channel-activity-reporter.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ChannelActivitySnapshot {
  consecutiveFailures?: number;
  lastFailure?: ChannelFailureDiagnostic;
  lastRecoveredAt?: Date;
  lastFailedPollAt?: Date;
  lastPollerStartedAt?: Date;
  lastPollerStoppedAt?: Date;
  lastSuccessfulPollAt?: Date;
  pollerRunning?: boolean;
}

export class ChannelActivityMonitor implements ChannelActivityReporter {
  public constructor(
    private readonly onRecovery: (details: {
      channel: ClientChannelKind;
      failureCount: number;
      recoveredAt: string;
    }) => void = () => undefined,
  ) {}
  private readonly activity = new Map<
    ClientChannelKind,
    ChannelActivitySnapshot
  >();

  public recordPollFailed(
    channel: ClientChannelKind,
    occurredAt: Date,
    diagnostic?: ChannelFailureDiagnostic,
  ): void {
    this.activity.set(channel, {
      ...this.activity.get(channel),
      lastFailedPollAt: occurredAt,
      consecutiveFailures:
        (this.activity.get(channel)?.consecutiveFailures ?? 0) + 1,
      lastFailure: structuredClone(diagnostic ?? { stage: 'poll' }),
    });
  }

  public recordPollerStarted(
    channel: ClientChannelKind,
    occurredAt: Date,
  ): void {
    this.activity.set(channel, {
      ...this.activity.get(channel),
      lastPollerStartedAt: occurredAt,
      pollerRunning: true,
    });
  }

  public recordPollerStopped(
    channel: ClientChannelKind,
    occurredAt: Date,
  ): void {
    this.activity.set(channel, {
      ...this.activity.get(channel),
      lastPollerStoppedAt: occurredAt,
      pollerRunning: false,
    });
  }

  public recordPollSucceeded(
    channel: ClientChannelKind,
    occurredAt: Date,
  ): void {
    const previous = this.activity.get(channel);
    const recovered = (previous?.consecutiveFailures ?? 0) > 0;
    this.activity.set(channel, {
      ...previous,
      lastSuccessfulPollAt: occurredAt,
      consecutiveFailures: 0,
      ...(recovered ? { lastRecoveredAt: occurredAt } : {}),
    });
    if (recovered) {
      this.onRecovery({
        channel,
        failureCount: previous?.consecutiveFailures ?? 0,
        recoveredAt: occurredAt.toISOString(),
      });
    }
  }

  public snapshot(channel: ClientChannelKind): ChannelActivitySnapshot {
    return structuredClone(this.activity.get(channel) ?? {});
  }
}
