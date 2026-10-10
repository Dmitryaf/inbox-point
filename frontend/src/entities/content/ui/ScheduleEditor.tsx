import '@frontend/entities/content/styles/schedule-editor.react-data-r-e7737cb0.css';
import { renderScheduleEditorLayout1 } from './ScheduleEditor.layout1';
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
  const itemKey = $unref($state.itemKey);
  const itemLimit = $unref($state.itemLimit);
  const hasContent = $state.hasContent.value;
  const draft = $state.draft.value;
  const legacyResponse = $state.legacyResponse.value;
  const responseLength = $state.responseLength.value;
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      {renderScheduleEditorLayout1(
        {
          ...$attributes,
          open: true,
          className: $class('field-group', $attributes.className),
          'data-r-e7737cb0': '',
        },
        renderScheduleEditorPart1($state),
        { modelValue: draft, onModelValueChange: $setter($state, 'draft') },
        { modelValue: draft, onModelValueChange: $setter($state, 'draft') },
        draft.legacySchedule ? (
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
        ) : null,
        draft.schedule.length === 0 ? (
          <p className="empty" data-r-e7737cb0="">
            {
              ' Старых карточек нет. Новые направления и группы добавляются выше. '
            }
          </p>
        ) : null,
        $renderList(draft.schedule, (item, index) => (
          <ScheduleItemFields
            key={itemKey(item)}
            errors={props.errors}
            index={index}
            modelValue={draft}
            onModelValueChange={$setter($state, 'draft')}
            data-r-e7737cb0=""
          />
        )),
        draft.schedule.length,
        itemLimit,
        {
          disabled: draft.schedule.length >= itemLimit,
          onClick: $nativeHandler(add),
        },
        {
          className: $class('counter', {
            'counter--error': responseLength > 4000,
          }),
        },
        responseLength,
        {
          contentPresent: hasContent,
          modelValue: draft.visibleSections,
          onModelValueChange: $propertySetter(
            () => $state.draft.value,
            'visibleSections',
          ),
        },
      )}
    </ModelScopeProvider>
  );
}
