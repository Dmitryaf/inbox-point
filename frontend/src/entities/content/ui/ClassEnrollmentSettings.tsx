import '@frontend/entities/content/styles/class-editor.react-data-r-07c17d8d.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';

import { checkboxProperty as $checkboxProperty } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { renderClassEnrollmentSettingsPart1 } from './ClassEnrollmentSettings.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ClassEnrollmentSettings.model';

export default function ClassEnrollmentSettings(
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
  const group = $state.group.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-label="Запись в группу"
        className={$class('class-card', $attributes.className)}
        data-r-07c17d8d=""
      >
        <h3 data-r-07c17d8d="">{'Запись в группу'}</h3>
        <label className="class-check" data-r-07c17d8d="">
          <input
            type="checkbox"
            disabled={Boolean(group.review)}
            checked={group.enrollmentOpen}
            onChange={$checkboxProperty(
              () => $state.group.value,
              'enrollmentOpen',
            )}
            data-r-07c17d8d=""
          />
          {' Открыть набор в группу '}
        </label>
        <p data-r-07c17d8d="">
          {
            ' Включите набор — в карточке этой группы бот покажет кнопку «Записаться на занятие». При закрытом наборе этой кнопки нет. '
          }
        </p>
        {renderClassEnrollmentSettingsPart1($state)}
      </section>
    </ModelScopeProvider>
  );
}
