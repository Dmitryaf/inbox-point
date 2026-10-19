import type { AnalyticsReport } from '@frontend/entities/analytics/model/types';
export function analyticsReport(): AnalyticsReport {
  return {
    summary: { requests: 14, menuActions: 83 },
    channels: {
      telegram: { requests: 8, menuActions: 52 },
      vk: { requests: 6, menuActions: 31 },
    },
    period: '30d',
    channel: 'all',
    timeZone: 'UTC',
    recordedSince: '2026-09-05T00:00:00Z',
    observedAt: '2026-10-04T12:00:00Z',
    lastRequestAt: '2026-10-04T10:00:00Z',
    actions: [
      { key: 'prices', label: 'Цены', count: 50, telegram: 30, vk: 20 },
      {
        key: 'custom:synthetic-id',
        label: 'Записаться на пробное',
        count: 20,
        telegram: 15,
        vk: 5,
      },
      { key: 'handoff', label: 'Задать вопрос', count: 13, telegram: 7, vk: 6 },
    ],
    daily: [
      { date: '2026-10-03', requests: 8, menuActions: 45 },
      { date: '2026-10-04', requests: 6, menuActions: 38 },
    ],
  };
}
