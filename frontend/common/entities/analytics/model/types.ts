import type { UsageAnalytics, UsageTotals } from '@core/model/usage-event';
export type AnalyticsPeriod = '7d' | '30d' | '90d';
export type AnalyticsChannel = 'all' | 'telegram' | 'vk';
export interface AnalyticsReport extends UsageAnalytics {
  summary: UsageTotals;
  period: AnalyticsPeriod;
  channel: AnalyticsChannel;
  recordedSince: string;
  observedAt: string;
  timeZone: 'UTC';
}
