import type { ClientChannelKind } from './support-message.js';

export const usageEventTypes = [
  'new_request',
  'information_section',
  'menu_action',
  'first_reply',
  'delivery_failure',
  'web_takeover',
] as const;

export type UsageEventType = (typeof usageEventTypes)[number];

export interface UsageEvent {
  actionKey?: string;
  actionLabel?: string;
  channel: ClientChannelKind;
  id: string;
  occurredAt: Date;
  requestId?: string;
  type: UsageEventType;
}

export type UsageEventCounts = Record<UsageEventType, number>;

export interface UsageTotals {
  requests: number;
  menuActions: number;
}

export interface UsageActionCount {
  key: string;
  label: string;
  count: number;
  telegram: number;
  vk: number;
}

export interface UsageDailyCount extends UsageTotals {
  date: string;
}

export interface UsageAnalytics {
  channels: Record<ClientChannelKind, UsageTotals>;
  actions: UsageActionCount[];
  daily: UsageDailyCount[];
  lastRequestAt: string | null;
}
