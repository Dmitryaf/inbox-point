import '@frontend/entities/content/styles/class-editor.react-data-r-13661f32.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderClassScheduleEditorPart1 } from './ClassScheduleEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassScheduleEditor.model';

export default function ClassScheduleEditor($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { back } = $state;
  const group = $state.group.value;
  const direction = $state.direction.value;
  const reviewing = $state.reviewing.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Занятия"
        className={$class('card class-workspace', $attributes.className)}
        data-r-13661f32=""
      >
        {$or(
          $or(direction, () => group),
          () => reviewing,
        ) ? (
          <button
            type="button"
            onClick={$nativeHandler(back)}
            className="secondary-button"
            data-r-13661f32=""
          >
            {group && direction
              ? 'К направлению «' + direction.name + '»'
              : 'Все направления'}
          </button>
        ) : null}
        <h2 id="class-directions" tabIndex={-1} data-r-13661f32="">
          {group
            ? (direction?.name ?? 'Нужно проверить') +
              ' → ' +
              $or(group.name, () => 'Занятие')
            : (direction?.name ?? (reviewing ? 'Нужно проверить' : 'Занятия'))}
        </h2>
        {renderClassScheduleEditorPart1($state)}
      </section>
    </ModelScopeProvider>
  );
}
