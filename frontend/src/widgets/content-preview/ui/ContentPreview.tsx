import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderContentPreviewPart1 } from './ContentPreview.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ContentPreview.model';

export default function ContentPreview($incomingProps: ComponentProps) {
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
      <section
        {...$attributes}
        aria-labelledby="preview-title"
        className={$class('card preview', $attributes.className)}
      >
        <p className="step">{'Предпросмотр'}</p>
        <h2 id="preview-title">{'Что появится в каналах'}</h2>
        {renderContentPreviewPart1($state)}
      </section>
    </ModelScopeProvider>
  );
}
