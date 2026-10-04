import type { DatabaseSync } from 'node:sqlite';
import type { ClientChannelKind } from '@/core/model/support-message.js';
import type {
  UsageAnalytics,
  UsageDailyCount,
} from '@/core/model/usage-event.js';

export function getUsageAnalytics(
  database: DatabaseSync,
  since: Date,
  until: Date,
  channel?: ClientChannelKind,
): UsageAnalytics {
  const params = [
    since.toISOString(),
    until.toISOString(),
    channel ?? null,
    channel ?? null,
  ];
  const filtered = `WITH filtered AS (
    SELECT * FROM usage_events WHERE occurred_at >= ? AND occurred_at <= ?
    AND (? IS NULL OR channel = ?)
    AND event_type IN ('new_request', 'menu_action', 'information_section')
  )`;
  const channels: UsageAnalytics['channels'] = {
    telegram: { requests: 0, menuActions: 0 },
    vk: { requests: 0, menuActions: 0 },
  };
  const totals = database
    .prepare(
      `${filtered}
    SELECT channel, SUM(event_type = 'new_request') AS requests,
      SUM(event_type != 'new_request') AS menuActions
    FROM filtered GROUP BY channel`,
    )
    .all(...params) as unknown as {
    channel: ClientChannelKind;
    requests: number;
    menuActions: number;
  }[];
  for (const row of totals) {
    channels[row.channel] = {
      requests: row.requests,
      menuActions: row.menuActions,
    };
  }
  const actions = database
    .prepare(
      `${filtered}, menu AS (
    SELECT *, COALESCE(action_key, 'legacy_information') AS key FROM filtered
    WHERE event_type != 'new_request'
  ) SELECT key,
    COALESCE((SELECT action_label FROM menu AS latest WHERE latest.key = menu.key
      ORDER BY occurred_at DESC, id DESC LIMIT 1), 'Разделы без названия') AS label,
    COUNT(*) AS count, SUM(channel = 'telegram') AS telegram, SUM(channel = 'vk') AS vk
    FROM menu GROUP BY key ORDER BY count DESC, label, key`,
    )
    .all(...params) as unknown as UsageAnalytics['actions'];
  const daily = database
    .prepare(
      `${filtered}
    SELECT substr(occurred_at, 1, 10) AS date, SUM(event_type = 'new_request') AS requests,
      SUM(event_type != 'new_request') AS menuActions
    FROM filtered GROUP BY date ORDER BY date`,
    )
    .all(...params) as unknown as UsageDailyCount[];
  const last = database
    .prepare(
      `${filtered}
    SELECT MAX(occurred_at) AS date FROM filtered WHERE event_type = 'new_request'`,
    )
    .get(...params) as { date: string | null };
  return { actions, channels, daily, lastRequestAt: last.date };
}
