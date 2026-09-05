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
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <div
        {...$attributes}
        className={$class('save-bar', $attributes.className)}
      >
        <div>
          <span className="save-bar-label">{'Публикация'}</span>
          <p role="status" className={$class({ changed: $props.dirty })}>
            {$props.dirty
              ? 'Есть несохранённые изменения'
              : 'Все изменения сохранены'}
          </p>
        </div>
        <button
          disabled={$or($props.saving, () => !$props.dirty)}
          type="button"
          onClick={() => {
            void $emit('save');
          }}
        >
          {$props.saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </div>
    </ModelScopeProvider>
  );
}
