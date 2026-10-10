import '@frontend/entities/content/styles/class-editor.react-data-r-03f428ee.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderClassGroupEditorPart1 } from './ClassGroupEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassGroupEditor.model';

export default function ClassGroupEditor($incomingProps: ComponentProps) {
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
      {renderClassGroupEditorPart1($state, $props)}
    </ModelScopeProvider>
  );
}
