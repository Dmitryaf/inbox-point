import { request } from '@frontend/shared/api/http-client';
import type {
  AnalyticsChannel,
  AnalyticsPeriod,
  AnalyticsReport,
} from '@frontend/entities/analytics/model/types';
export function loadAnalytics(
  period: AnalyticsPeriod,
  channel: AnalyticsChannel,
  signal: AbortSignal,
): Promise<AnalyticsReport> {
  return request(`/api/analytics?${new URLSearchParams({ period, channel })}`, {
    signal,
  });
}
