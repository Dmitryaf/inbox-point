import {
  type ComponentAttributes,
  type WithDefaults,
} from '@frontend/shared/lib/component-model';

import { computed } from '@frontend/shared/lib/model-state';
import type { AnalyticsReport } from '@frontend/entities/analytics/model/types';

export type ComponentProps = {
  report: AnalyticsReport;
} & ComponentAttributes;
export const componentDefaults = {};
type ResolvedProps = WithDefaults<ComponentProps, typeof componentDefaults>;
export function createComponentModel($props: ResolvedProps) {
  const props = $props;
  const questionChoices = computed(() =>
    props.report.actions
      .filter(
        (action) => action.key === 'handoff' || action.key === 'new_question',
      )
      .reduce((sum, action) => sum + action.count, 0),
  );
  const lastRequest = computed(() =>
    props.report.lastRequestAt
      ? new Intl.DateTimeFormat('ru-RU', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'UTC',
        }).format(new Date(props.report.lastRequestAt))
      : '',
  );
  return { questionChoices, lastRequest };
}
