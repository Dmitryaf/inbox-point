import { renderAnalyticsOverviewPart3 } from './AnalyticsOverview.part3';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart2(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <section className="card" data-r-b5a5a8db="">
        <h2 data-r-b5a5a8db="">{'Популярные действия'}</h2>
        {renderAnalyticsOverviewPart3($props)}
        {$props.report.actions.some(
          (action) => action.key === 'legacy_information',
        ) ? (
          <p className="muted" data-r-b5a5a8db="">
            {' В старой статистике названия разделов не сохранялись. '}
          </p>
        ) : null}
      </section>
    </>
  );
}
