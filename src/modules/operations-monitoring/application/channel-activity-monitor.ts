import type { ChannelActivityReporter } from '@/core/contracts/channel-activity-reporter.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ChannelActivitySnapshot {
  lastFailedPollAt?: Date;
  lastPollerStartedAt?: Date;
  lastPollerStoppedAt?: Date;
  lastSuccessfulPollAt?: Date;
  pollerRunning?: boolean;
}

export class ChannelActivityMonitor implements ChannelActivityReporter {
  private readonly activity = new Map<
    ClientChannelKind,
    ChannelActivitySnapshot
  >();

  public recordPollFailed(channel: ClientChannelKind, occurredAt: Date): void {
    this.activity.set(channel, {
      ...this.activity.get(channel),
      lastFailedPollAt: occurredAt,
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
    this.activity.set(channel, {
      ...this.activity.get(channel),
      lastSuccessfulPollAt: occurredAt,
    });
  }

  public snapshot(channel: ClientChannelKind): ChannelActivitySnapshot {
    return { ...this.activity.get(channel) };
  }
}
