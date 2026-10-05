import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { ApiRequestDiagnostic } from '@/core/model/api-request-diagnostic.js';

export interface ChannelFailureDiagnostic {
  request?: ApiRequestDiagnostic | undefined;
  stage: 'startup' | 'poll';
}

export interface ChannelActivityReporter {
  recordPollFailed(
    channel: ClientChannelKind,
    occurredAt: Date,
    diagnostic?: ChannelFailureDiagnostic,
  ): void;
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
