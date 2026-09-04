import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import { renderRestoreActionPart1 } from './RestoreAction.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './RestoreAction.model';

export default function RestoreAction($incomingProps: ComponentProps) {
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
      {renderRestoreActionPart1($state, $props)}
    </ModelScopeProvider>
  );
}
