import '@frontend/entities/content/styles/collection-editor.react-data-r-f3bf3992.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import FieldError from '@frontend/shared/ui/FieldError';

import { renderScheduleItemFieldsPart1 } from './ScheduleItemFields.part1';
import { renderScheduleItemFieldsPart2 } from './ScheduleItemFields.part2';
import { renderScheduleItemFieldsPart3 } from './ScheduleItemFields.part3';
import { renderScheduleItemFieldsPart4 } from './ScheduleItemFields.part4';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ScheduleItemFields.model';

export default function ScheduleItemFields($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const item = $state.item.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <fieldset
        {...$attributes}
        className={$class('item-card', $attributes.className)}
        data-r-f3bf3992=""
      >
        <legend data-r-f3bf3992="">
          {'Направление '}
          {$props.index + 1}
        </legend>
        <label htmlFor={`schedule-title-${$props.index}`} data-r-f3bf3992="">
          {'Направление / группа'}
        </label>
        {renderScheduleItemFieldsPart1($state, $props)}
        <FieldError
          id={`schedule-title-${$props.index}-error`}
          text={$props.errors[`schedule-title-${$props.index}`]}
          data-r-f3bf3992=""
        />
        <p className="counter" data-r-f3bf3992="">
          {item.title.length}
          {' / 120'}
        </p>
        <label htmlFor={`schedule-day-time-${$props.index}`} data-r-f3bf3992="">
          {'День / время'}
        </label>
        {renderScheduleItemFieldsPart2($state, $props)}
        <FieldError
          id={`schedule-day-time-${$props.index}-error`}
          text={$props.errors[`schedule-day-time-${$props.index}`]}
          data-r-f3bf3992=""
        />
        <p className="counter" data-r-f3bf3992="">
          {item.dayTime.length}
          {' / 120'}
        </p>
        <label
          htmlFor={`schedule-description-${$props.index}`}
          data-r-f3bf3992=""
        >
          {' Дополнительное описание '}
        </label>
        {renderScheduleItemFieldsPart3($state, $props)}
        <FieldError
          id={`schedule-description-${$props.index}-error`}
          text={$props.errors[`schedule-description-${$props.index}`]}
          data-r-f3bf3992=""
        />
        <p className="counter" data-r-f3bf3992="">
          {item.description?.length ?? 0}
          {' / 1000'}
        </p>
        {renderScheduleItemFieldsPart4($state, $props)}
      </fieldset>
    </ModelScopeProvider>
  );
}
