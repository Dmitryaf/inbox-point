import { renderAnalyticsOverviewPart2 } from './AnalyticsOverview.part2';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  ComponentProps,
  componentDefaults,
} from './AnalyticsOverview.model';
export function renderAnalyticsOverviewPart1(
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  return (
    <>
      <header className="analytics-summary" data-r-b5a5a8db="">
        <h2 data-r-b5a5a8db="">{'Использование за период'}</h2>
        <dl className="usage-totals" data-r-b5a5a8db="">
          <div data-r-b5a5a8db="">
            <dt data-r-b5a5a8db="">{'Обращения'}</dt>
            <dd className="metric-value" data-r-b5a5a8db="">
              {$props.report.summary.requests}
            </dd>
          </div>
          <div data-r-b5a5a8db="">
            <dt data-r-b5a5a8db="">{'Выборы в меню'}</dt>
            <dd className="metric-value" data-r-b5a5a8db="">
              {$props.report.summary.menuActions}
            </dd>
          </div>
        </dl>
        {renderAnalyticsOverviewPart2($props)}
      </header>
    </>
  );
}
