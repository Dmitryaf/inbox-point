import type { ChannelActivitySnapshot } from '@/modules/operations-monitoring/application/channel-activity-monitor.js';
import type {
  ChannelConnectionSource,
  ChannelOperationsStatus,
} from '@/modules/operations-monitoring/model/operations-status.js';

export interface ChannelStatusSnapshot {
  connected: boolean;
  source: ChannelConnectionSource;
}

export function mapChannelStatus(
  status: ChannelStatusSnapshot,
  activity: ChannelActivitySnapshot,
  observedAt: Date,
  startedAt: Date,
  pollStaleAfterMs: number,
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
    running: status.connected && activity.pollerRunning !== false,
    source: status.source,
    state: resolveChannelState(
      status,
      activity,
      observedAt,
      startedAt,
      pollStaleAfterMs,
    ),
  };
}

export function channelNeedsAttention(
  channel: ChannelOperationsStatus,
): boolean {
  return channel.state !== 'running' && channel.state !== 'starting';
}

export function channelIsReady(channel: ChannelOperationsStatus): boolean {
  return (
    channel.state === 'not_configured' ||
    channel.state === 'running' ||
    channel.state === 'starting'
  );
}

function resolveChannelState(
  status: ChannelStatusSnapshot,
  activity: ChannelActivitySnapshot,
  observedAt: Date,
  startedAt: Date,
  pollStaleAfterMs: number,
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
  if (!status.connected || activity.pollerRunning === false) {
    return 'stopped';
  }
  if (!activity.lastSuccessfulPollAt) {
    return resolveInitialPollState(observedAt, startedAt, pollStaleAfterMs);
  }
  if (
    isPollStale(activity.lastSuccessfulPollAt, observedAt, pollStaleAfterMs)
  ) {
    return 'poll_stale';
  }
  return 'running';
}

function resolveInitialPollState(
  observedAt: Date,
  startedAt: Date,
  pollStaleAfterMs: number,
): ChannelOperationsStatus['state'] {
  const startupElapsedMs = elapsedMilliseconds(startedAt, observedAt);

  if (startupElapsedMs <= pollStaleAfterMs) {
    return 'starting';
  }
  return 'poll_stale';
}

function isPollStale(
  lastSuccessfulPollAt: Date,
  observedAt: Date,
  pollStaleAfterMs: number,
): boolean {
  return (
    elapsedMilliseconds(lastSuccessfulPollAt, observedAt) > pollStaleAfterMs
  );
}

function elapsedMilliseconds(from: Date, to: Date): number {
  return Math.max(0, to.getTime() - from.getTime());
}
