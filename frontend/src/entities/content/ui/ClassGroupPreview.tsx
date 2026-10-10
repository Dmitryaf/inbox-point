import '@frontend/entities/content/styles/class-editor.react-data-r-e40bbebd.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderClassGroupPreviewPart1 } from './ClassGroupPreview.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassGroupPreview.model';

export default function ClassGroupPreview($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const response = $state.response.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <details
        {...$attributes}
        className={$class('class-preview', $attributes.className)}
        data-r-e40bbebd=""
      >
        <summary data-r-e40bbebd="">{'Что увидит клиент'}</summary>
        <p data-r-e40bbebd="">
          {
            ' Пример текста и действий. Внешний вид кнопок зависит от VK или Telegram. '
          }
        </p>
        <pre data-r-e40bbebd="">{response.text}</pre>
        {renderClassGroupPreviewPart1($state)}
      </details>
    </ModelScopeProvider>
  );
}
