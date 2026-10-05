import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed, ref } from '@frontend/shared/lib/model-state';
import type { UsageDailyCount } from '@core/model/usage-event';

export type ComponentProps = {
  daily: UsageDailyCount[];
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const dailyExpanded = ref(false);
  const recentDays = computed(() => [...props.daily].reverse());
  const maximum = computed(() =>
    Math.max(
      1,
      ...props.daily.flatMap((day) => [day.requests, day.menuActions]),
    ),
  );
  const points = (key: 'requests' | 'menuActions') =>
    props.daily
      .map(
        (day, index) => `${x(index)},${190 - (day[key] / maximum.value) * 160}`,
      )
      .join(' ');
  function x(index: number): number {
    return 48 + (index / Math.max(1, props.daily.length - 1)) * 604;
  }
  const ticks = computed(() =>
    [
      ...new Set([
        0,
        Math.floor((props.daily.length - 1) / 2),
        props.daily.length - 1,
      ]),
    ].filter((index) => index >= 0),
  );
  function label(date: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  }
  return { dailyExpanded, recentDays, maximum, points, x, ticks, label };
}
