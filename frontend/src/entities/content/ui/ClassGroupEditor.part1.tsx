import { renderClassGroupEditorPart1Layout2 } from './ClassGroupEditor.part1.layout2';
import { renderClassGroupEditorPart1Layout1 } from './ClassGroupEditor.part1.layout1';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  requiredValue as $required,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';
import {
  textProperty as $textProperty,
  checkboxProperty as $checkboxProperty,
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
  const initiallyOpen = $unref($state.initiallyOpen);
  const group = $state.group.value;
  const draft = $state.draft.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {group
        ? renderClassGroupEditorPart1Layout2(
            {
              ...$attributes,
              open: initiallyOpen,
              className: $class('class-card', $attributes.className),
              'data-r-03f428ee': '',
            },
            $or(group.name, () => 'Новая группа'),
            group.enrollmentOpen ? 'Набор открыт' : 'Набор закрыт',
            { htmlFor: `group-name-${group.id}` },
            {
              id: `group-name-${group.id}`,
              maxLength: 80,
              value: group.name ?? '',
              onChange: $textProperty(() => $state.group.value, 'name'),
            },
            { htmlFor: `group-direction-${group.id}` },
            {
              id: `group-direction-${group.id}`,
              value: group.directionId ?? '',
              onChange: $textProperty(() => $state.group.value, 'directionId'),
            },
            $renderList(draft.directions, (direction) => (
              <option
                key={direction.id}
                value={direction.id}
                data-r-03f428ee=""
              >
                {direction.name}
              </option>
            )),
            $renderList(group.meetings, (_, index) =>
              renderClassGroupEditorPart1Layout1(
                { key: index },
                { htmlFor: `group-time-${group.id}-${index}` },
                index + 1,
                {
                  id: `group-time-${group.id}-${index}`,
                  maxLength: 120,
                  value: group.meetings[index] ?? '',
                  onChange: $textProperty(
                    () => $required($state.group.value).meetings,
                    index,
                  ),
                },
                group.meetings.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      void $required($state.group.value).meetings.splice(
                        index,
                        1,
                      )
                    }
                    data-r-03f428ee=""
                  >
                    {' Удалить время '}
                    {index + 1}
                  </button>
                ) : null,
              ),
            ),
            {
              disabled: group.meetings.length >= 7,
              onClick: () =>
                void $required($state.group.value).meetings.push(''),
            },
            { htmlFor: `group-description-${group.id}` },
            {
              id: `group-description-${group.id}`,
              rows: 3,
              maxLength: 1000,
              value: group.description ?? '',
              onChange: $textProperty(() => $state.group.value, 'description'),
            },
            {
              checked: group.enrollmentOpen,
              onChange: $checkboxProperty(
                () => $state.group.value,
                'enrollmentOpen',
              ),
            },
            { htmlFor: `group-question-${group.id}` },
            {
              id: `group-question-${group.id}`,
              rows: 2,
              maxLength: 1000,
              value: group.applicationQuestion ?? '',
              onChange: $textProperty(
                () => $state.group.value,
                'applicationQuestion',
              ),
            },
            { content: draft, groupId: group.id },
            { onClick: $nativeHandler(remove) },
          )
        : null}
    </>
  );
}
