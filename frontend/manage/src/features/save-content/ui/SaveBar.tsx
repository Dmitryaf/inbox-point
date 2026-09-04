import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import { classNames as $class } from '@manage/shared/lib/component-view';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

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
        <p role="status" className={$class({ changed: $props.dirty })}>
          {$props.dirty
            ? 'Есть несохранённые изменения'
            : 'Все изменения сохранены'}
        </p>
        <button
          disabled={$props.saving || !$props.dirty}
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
