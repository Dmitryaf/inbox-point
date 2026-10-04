import type { SupportRepository } from '@/core/contracts/support-repository.js';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type { UsageAnalytics, UsageTotals } from '@/core/model/usage-event.js';

export const analyticsPeriods = ['7d', '30d', '90d'] as const;
export type AnalyticsPeriod = (typeof analyticsPeriods)[number];
export type AnalyticsChannel = 'all' | ClientChannelKind;
export interface AnalyticsReport extends UsageAnalytics {
  summary: UsageTotals;
  period: AnalyticsPeriod;
  channel: AnalyticsChannel;
  recordedSince: string;
  observedAt: string;
  timeZone: 'UTC';
}

export class AnalyticsService {
  public constructor(
    private readonly repository: Pick<SupportRepository, 'getUsageAnalytics'>,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public get(
    period: AnalyticsPeriod = '30d',
    channel: AnalyticsChannel = 'all',
  ): AnalyticsReport {
    const now = this.clock();
    const days = Number.parseInt(period, 10);
    const since = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - days + 1,
      ),
    );
    const data = this.repository.getUsageAnalytics(
      since,
      now,
      channel === 'all' ? undefined : channel,
    );
    const dailyByDate = new Map(data.daily.map((day) => [day.date, day]));
    const daily = Array.from({ length: days }, (_, index) => {
      const date = new Date(since.getTime() + index * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return dailyByDate.get(date) ?? { date, requests: 0, menuActions: 0 };
    });
    return {
      ...data,
      daily,
      period,
      channel,
      timeZone: 'UTC',
      recordedSince: since.toISOString(),
      observedAt: now.toISOString(),
      summary: {
        requests: data.channels.telegram.requests + data.channels.vk.requests,
        menuActions:
          data.channels.telegram.menuActions + data.channels.vk.menuActions,
      },
    };
  }
}
