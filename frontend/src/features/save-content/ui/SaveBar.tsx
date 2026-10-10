import '@frontend/features/save-content/styles/save-bar.react-data-r-80a75b00.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderSaveBarPart1 } from './SaveBar.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './SaveBar.model';

export default function SaveBar($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const statusMessage = $state.statusMessage.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div
        {...$attributes}
        className={$class('save-bar', $attributes.className)}
        data-r-80a75b00=""
      >
        <div data-r-80a75b00="">
          <span className="save-bar-label" data-r-80a75b00="">
            {'Сохранятся изменения во всех разделах'}
          </span>
          <p
            role="status"
            className={$class({ changed: $props.dirty })}
            data-r-80a75b00=""
          >
            {statusMessage}
          </p>
        </div>
        {renderSaveBarPart1($state, $props)}
      </div>
    </ModelScopeProvider>
  );
}
