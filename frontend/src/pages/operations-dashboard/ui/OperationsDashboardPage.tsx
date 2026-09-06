import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderOperationsDashboardPagePart1 } from './OperationsDashboardPage.part1';
import { renderOperationsDashboardPagePart2 } from './OperationsDashboardPage.part2';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsDashboardPage.model';

export default function OperationsDashboardPage(
  $incomingProps: ComponentProps,
) {
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
      <main
        {...$attributes}
        className={$class('ops-shell', $attributes.className)}
      >
        {renderOperationsDashboardPagePart1($state)}
        {renderOperationsDashboardPagePart2($state, $scope)}
      </main>
    </ModelScopeProvider>
  );
}
