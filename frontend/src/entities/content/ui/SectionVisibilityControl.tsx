import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { invokeHandler as $invoke } from '@frontend/shared/lib/component-events';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './SectionVisibilityControl.model';
import { controlledChange as $controlledChange } from '@frontend/shared/lib/component-input-event';

export default function SectionVisibilityControl(
  $incomingProps: ComponentProps,
) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { updateVisibility } = $state;
  const visibleSections = $state.visibleSections.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <label
        {...$attributes}
        className={$class('visibility-control', $attributes.className)}
      >
        <input
          checked={visibleSections.includes($props.section)}
          type="checkbox"
          onChange={$controlledChange<HTMLInputElement>(($event) => {
            $invoke(updateVisibility, $event);
          })}
        />
        <span>
          {' Показывать кнопку клиентам '}
          {!$props.contentPresent ? (
            <small>{' Пустой раздел всё равно не появится в меню. '}</small>
          ) : null}
        </span>
      </label>
    </ModelScopeProvider>
  );
}
