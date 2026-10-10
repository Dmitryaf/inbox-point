import { renderClassGroupEditorPart1Layout1 } from './ClassGroupEditor.part1.layout1';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
} from '@frontend/shared/lib/component-bindings';
import {
  textModel as $textModel,
  textProperty as $textProperty,
} from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClassGroupEditor.model';
export function renderClassGroupEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { remove } = $state;
  const group = $state.group.value;
  const draft = $state.draft.value;
  const schedule = $state.schedule.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {group
        ? renderClassGroupEditorPart1Layout1(
            {
              ...$attributes,
              className: $class('class-editor', $attributes.className),
              'data-r-03f428ee': '',
            },
            {
              modelValue: group,
              groups: draft.groups,
              onOpenGroup: ($event) =>
                void $unref($state.emit)('openTarget', 'group', $event),
            },
            { htmlFor: 'group-direction-' + group.id },
            {
              id: 'group-direction-' + group.id,
              value: group.directionId ?? '',
              onChange: $textProperty(() => $state.group.value, 'directionId'),
            },
            $renderList(draft.directions, (item) => (
              <option key={item.id} value={item.id} data-r-03f428ee="">
                {item.name}
              </option>
            )),
            !draft.directions.length ? (
              <p className="class-hint" data-r-03f428ee="">
                {' Сначала добавьте направление на экране «Занятия». '}
              </p>
            ) : null,
            { htmlFor: 'group-name-' + group.id },
            {
              id: 'group-name-' + group.id,
              maxLength: 80,
              value: group.name ?? '',
              onChange: $textProperty(() => $state.group.value, 'name'),
            },
            { htmlFor: 'group-time-' + group.id + '-0' },
            {
              id: 'group-time-' + group.id + '-0',
              rows: 2,
              value: schedule ?? '',
              onChange: $textModel($state, 'schedule'),
            },
            {
              directions: draft.directions,
              groups: draft.groups,
              modelValue: group,
              onModelValueChange: $setter($state, 'group'),
            },
            {
              targetId: group.id,
              onOpenTarget: (type, id) =>
                $unref($state.emit)('openTarget', type, id),
              modelValue: draft,
              onModelValueChange: $setter($state, 'draft'),
            },
            {
              onClick: () =>
                void $unref($state.emit)(
                  'preview',
                  'classes:group:' + $required($state.group.value).id,
                ),
            },
            { onClick: $nativeHandler(remove) },
            { modelValue: group },
          )
        : null}
    </>
  );
}
