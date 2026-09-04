import type { ChannelActivityReporter } from '@/core/contracts/channel-activity-reporter.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ChannelActivitySnapshot {
  lastFailedPollAt?: Date;
  lastSuccessfulPollAt?: Date;
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
