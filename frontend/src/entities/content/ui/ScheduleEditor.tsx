import '@frontend/entities/content/styles/schedule-editor.react-data-r-e7737cb0.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  propertySetter as $propertySetter,
} from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import SectionVisibilityControl from './SectionVisibilityControl';
import ScheduleItemFields from './ScheduleItemFields';

import { renderScheduleEditorPart1 } from './ScheduleEditor.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ScheduleEditor.model';

export default function ScheduleEditor($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { props, add } = $state;
  const itemLimit = $unref($state.itemLimit);
  const itemKey = $unref($state.itemKey);
  const hasContent = $state.hasContent.value;
  const draft = $state.draft.value;
  const responseLength = $state.responseLength.value;
  const legacyResponse = $state.legacyResponse.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <details
        {...$attributes}
        open
        className={$class('field-group', $attributes.className)}
        data-r-e7737cb0=""
      >
        {renderScheduleEditorPart1($state)}
        <div className="section-heading" data-r-e7737cb0="">
          <p data-r-e7737cb0="">
            {'Направления и группы показываются в этом порядке.'}
          </p>
          <span data-r-e7737cb0="">
            {draft.schedule.length}
            {' / '}
            {itemLimit}
          </span>
        </div>
        <p
          aria-live="polite"
          className={$class('counter', {
            'counter--error': responseLength > 4000,
          })}
          data-r-e7737cb0=""
        >
          {' Итоговый ответ: '}
          {responseLength}
          {' / 4000 '}
        </p>
        <SectionVisibilityControl
          contentPresent={hasContent}
          section="schedule"
          modelValue={draft.visibleSections}
          onModelValueChange={$propertySetter(
            () => $state.draft.value,
            'visibleSections',
          )}
          data-r-e7737cb0=""
        />
        {draft.legacySchedule ? (
          <aside className="legacy-schedule" data-r-e7737cb0="">
            <strong data-r-e7737cb0="">
              {'Сохранён старый текст расписания'}
            </strong>
            <p data-r-e7737cb0="">
              {
                ' Перенесите его в карточки вручную. Пока заполненных карточек нет, при сохранении старый текст останется без изменений. '
              }
            </p>
            <pre id="legacy-schedule" data-r-e7737cb0="">
              {legacyResponse}
            </pre>
          </aside>
        ) : null}
        {draft.schedule.length === 0 ? (
          <p className="empty" data-r-e7737cb0="">
            {
              ' Добавьте направление или группу, чтобы создать структурированное расписание. '
            }
          </p>
        ) : null}
        {$renderList(draft.schedule, (item, index) => (
          <ScheduleItemFields
            key={itemKey(item)}
            errors={props.errors}
            index={index}
            modelValue={draft}
            onModelValueChange={$setter($state, 'draft')}
            data-r-e7737cb0=""
          />
        ))}
        <button
          id="add-schedule"
          disabled={draft.schedule.length >= itemLimit}
          type="button"
          onClick={$nativeHandler(add)}
          data-r-e7737cb0=""
        >
          {' Добавить направление '}
        </button>
      </details>
    </ModelScopeProvider>
  );
}
