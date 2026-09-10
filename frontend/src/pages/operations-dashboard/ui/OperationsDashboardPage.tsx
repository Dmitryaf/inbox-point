import '@frontend/pages/operations-dashboard/styles/operations-dashboard-page.react-data-r-fef838bc.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderOperationsDashboardPagePart1 } from './OperationsDashboardPage.part1';
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

  return (
    <ModelScopeProvider scope={$scope}>
      {renderOperationsDashboardPagePart1($state, $props, $scope)}
    </ModelScopeProvider>
  );
}
