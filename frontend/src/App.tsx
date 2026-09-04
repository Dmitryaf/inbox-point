import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { dynamicComponent as $dynamic } from '@frontend/shared/lib/component-view';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './App.model';

export default function App($incomingProps: ComponentProps) {
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const currentPage = $state.currentPage.value;
  return (
    <ModelScopeProvider scope={$scope}>
      {$dynamic(currentPage, {}, <></>)}
    </ModelScopeProvider>
  );
}
