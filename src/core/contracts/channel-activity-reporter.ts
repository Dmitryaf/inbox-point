import type { ClientChannelKind } from '@/core/model/support-message.js';

export interface ChannelActivityReporter {
  recordPollFailed(channel: ClientChannelKind, occurredAt: Date): void;
  recordPollerStarted(channel: ClientChannelKind, occurredAt: Date): void;
  recordPollerStopped(channel: ClientChannelKind, occurredAt: Date): void;
  recordPollSucceeded(channel: ClientChannelKind, occurredAt: Date): void;
}

export const silentChannelActivityReporter: ChannelActivityReporter = {
  recordPollFailed: () => undefined,
  recordPollerStarted: () => undefined,
  recordPollerStopped: () => undefined,
  recordPollSucceeded: () => undefined,
};
