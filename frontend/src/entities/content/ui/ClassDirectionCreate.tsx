import '@frontend/entities/content/styles/class-editor.react-data-r-7bb6e793.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderClassDirectionCreatePart1 } from './ClassDirectionCreate.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassDirectionCreate.model';

export default function ClassDirectionCreate($incomingProps: ComponentProps) {
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
      {renderClassDirectionCreatePart1($state, $props)}
    </ModelScopeProvider>
  );
}
