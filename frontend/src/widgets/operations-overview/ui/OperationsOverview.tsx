import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderOperationsOverviewPart1 } from './OperationsOverview.part1';
import { renderOperationsOverviewPart2 } from './OperationsOverview.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsOverview.model';

export default function OperationsOverview($incomingProps: ComponentProps) {
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
        aria-labelledby="overview-title"
        className={$class('overview', $attributes.className)}
      >
        {renderOperationsOverviewPart1($state, $props)}
        {renderOperationsOverviewPart2($props)}
      </section>
    </ModelScopeProvider>
  );
}
