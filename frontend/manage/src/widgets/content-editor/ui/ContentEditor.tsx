import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

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
      <div {...$attributes} className={$class('editor', $attributes.className)}>
        {renderContentEditorPart1($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
