import {
  useComponentModel,
  ModelScopeProvider,
} from '@ops/shared/lib/component-model';

import { inheritedAttributes } from '@ops/shared/lib/component-attributes';
import OperationsDashboardPage from '@ops/pages/operations-dashboard/ui/OperationsDashboardPage';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './App.model';

export default function App($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const { scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );

  return (
    <ModelScopeProvider scope={$scope}>
      <OperationsDashboardPage {...$attributes} />
    </ModelScopeProvider>
  );
}
