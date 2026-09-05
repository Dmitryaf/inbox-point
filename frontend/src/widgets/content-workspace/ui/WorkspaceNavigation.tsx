import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderWorkspaceNavigationPart1 } from './WorkspaceNavigation.part1';
import { renderWorkspaceNavigationPart2 } from './WorkspaceNavigation.part2';
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
      {renderWorkspaceNavigationPart2($state, $props)}
    </ModelScopeProvider>
  );
}
