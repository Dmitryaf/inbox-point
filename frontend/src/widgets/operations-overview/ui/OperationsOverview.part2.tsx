import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './OperationsOverview.model';
export function renderOperationsOverviewPart2(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const overallLabel = $state.overallLabel.value;
  const overallDescription = $state.overallDescription.value;
  const observedAt = $state.observedAt.value;

  return (
    <>
      <article
        className={$class('service-summary', {
          'summary-card--attention': $or(
            $props.statusUnavailable,
            () => $props.status.state === 'attention',
          ),
          'summary-card--maintenance': $props.status.state === 'maintenance',
        })}
        data-r-2dc401be=""
      >
        <div data-r-2dc401be="">
          <h2 id="overview-title" data-r-2dc401be="">
            {overallLabel}
          </h2>
          <p className="summary-description" data-r-2dc401be="">
            {overallDescription}
          </p>
        </div>
        <dl className="summary-facts" data-r-2dc401be="">
          <div data-r-2dc401be="">
            <dt data-r-2dc401be="">{'Работает'}</dt>
            <dd data-r-2dc401be="">
              {$unref(formatUptime)($props.status.uptimeSeconds)}
            </dd>
          </div>
          <div data-r-2dc401be="">
            <dt data-r-2dc401be="">{'Данные обновлены'}</dt>
            <dd data-r-2dc401be="">{observedAt}</dd>
          </div>
        </dl>
      </article>
    </>
  );
}
