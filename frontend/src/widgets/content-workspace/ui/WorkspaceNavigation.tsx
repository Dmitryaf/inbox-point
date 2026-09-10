import '@frontend/widgets/content-workspace/styles/workspace-navigation.react-data-r-e6e22060.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderWorkspaceNavigationPart1 } from './WorkspaceNavigation.part1';
import { renderWorkspaceNavigationPart3 } from './WorkspaceNavigation.part3';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './WorkspaceNavigation.model';

export default function WorkspaceNavigation($incomingProps: ComponentProps) {
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
      {renderWorkspaceNavigationPart1($state, $props)}
      {renderWorkspaceNavigationPart3($state, $props)}
    </ModelScopeProvider>
  );
}
