import type { ClientChannelKind } from './support-message.js';

export const usageEventTypes = [
  'new_request',
  'information_section',
  'first_reply',
  'delivery_failure',
  'web_takeover',
] as const;

export type UsageEventType = (typeof usageEventTypes)[number];

export interface UsageEvent {
  channel: ClientChannelKind;
  id: string;
  occurredAt: Date;
  requestId?: string;
  type: UsageEventType;
}

export type UsageEventCounts = Record<UsageEventType, number>;
