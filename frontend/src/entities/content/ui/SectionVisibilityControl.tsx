import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './SectionVisibilityControl.model';

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
          onChange={$nativeHandler(updateVisibility)}
        />
        <span>
          {' Показывать кнопку в каналах '}
          {!$props.contentPresent ? (
            <small>{' Пустой раздел всё равно не появится в меню. '}</small>
          ) : null}
        </span>
      </label>
    </ModelScopeProvider>
  );
}
