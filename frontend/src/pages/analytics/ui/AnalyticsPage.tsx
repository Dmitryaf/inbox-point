import '@frontend/pages/analytics/styles/analytics-page.react-data-r-53e74af6.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderAnalyticsPagePart1 } from './AnalyticsPage.part1';
import { renderAnalyticsPagePart2 } from './AnalyticsPage.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './AnalyticsPage.model';

export default function AnalyticsPage($incomingProps: ComponentProps) {
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
      <section
        {...$attributes}
        aria-label="Использование ботов"
        className={$class('analytics-page', $attributes.className)}
        data-r-53e74af6=""
      >
        {renderAnalyticsPagePart1($state)}
        {renderAnalyticsPagePart2($state)}
      </section>
    </ModelScopeProvider>
  );
}
