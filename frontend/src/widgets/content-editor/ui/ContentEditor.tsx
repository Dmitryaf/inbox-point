import '@frontend/widgets/content-editor/styles/content-editor.react-data-r-7c201b3b.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderContentEditorPart1 } from './ContentEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentEditor.model';

export default function ContentEditor($incomingProps: ComponentProps) {
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
      <div
        {...$attributes}
        className={$class('editor', $attributes.className)}
        data-r-7c201b3b=""
      >
        {renderContentEditorPart1($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
