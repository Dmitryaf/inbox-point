import '@frontend/entities/content/styles/class-editor.react-data-r-71dc3e8a.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';

import { renderClassDirectionEditorPart1 } from './ClassDirectionEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassDirectionEditor.model';

export default function ClassDirectionEditor($incomingProps: ComponentProps) {
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
      {renderClassDirectionEditorPart1($state, $props)}
    </ModelScopeProvider>
  );
}
