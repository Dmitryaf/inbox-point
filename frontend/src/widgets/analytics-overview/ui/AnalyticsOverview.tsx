import '@frontend/widgets/analytics-overview/styles/analytics-overview.react-data-r-b5a5a8db.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AnalyticsActivity from './AnalyticsActivity';

import { renderAnalyticsOverviewPart1 } from './AnalyticsOverview.part1';
import { renderAnalyticsOverviewPart2 } from './AnalyticsOverview.part2';
import { renderAnalyticsOverviewPart4 } from './AnalyticsOverview.part4';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AnalyticsOverview.model';

export default function AnalyticsOverview($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div
        {...$attributes}
        aria-live="polite"
        className={$class('analytics-overview', $attributes.className)}
        data-r-b5a5a8db=""
      >
        {renderAnalyticsOverviewPart1($state, $props)}
        <AnalyticsActivity daily={$props.report.daily} data-r-b5a5a8db="" />
        {renderAnalyticsOverviewPart2($props)}
        {renderAnalyticsOverviewPart4($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
