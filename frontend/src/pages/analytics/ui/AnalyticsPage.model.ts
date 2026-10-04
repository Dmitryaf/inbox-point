import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import { useAnalytics } from '@frontend/pages/analytics/model/use-analytics';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useAdminShellSession();
  const { period, channel, report, loading, error, refresh } = useAnalytics(
    session.expireSession,
  );
  const empty = computed(() =>
    report.value
      ? report.value.summary.requests === 0 &&
        report.value.summary.menuActions === 0
      : report.value,
  );
  const periods = [
    { value: '7d', label: '7 дней' },
    { value: '30d', label: '30 дней' },
    { value: '90d', label: '90 дней' },
  ] as const;
  const channels = [
    { value: 'all', label: 'Все каналы' },
    { value: 'telegram', label: 'Telegram' },
    { value: 'vk', label: 'VK' },
  ] as const;
  return {
    period,
    channel,
    report,
    loading,
    error,
    refresh,
    empty,
    periods,
    channels,
  };
}
