import '@frontend/features/save-content/styles/save-bar.react-data-r-80a75b00.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

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
  const { $emit } = $state;
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
        <button
          aria-busy={$props.saving}
          disabled={$or($props.saving, () => !$props.dirty)}
          type="button"
          onClick={() => void $emit('save')}
          data-r-80a75b00=""
        >
          {' Сохранить '}
        </button>
      </div>
    </ModelScopeProvider>
  );
}
