import { renderClassGroupEditorPart1Layout1 } from './ClassGroupEditor.part1.layout1';
import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  requiredValue as $required,
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
  const group = $state.group.value;
  const draft = $state.draft.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {group
        ? renderClassGroupEditorPart1Layout1(
            {
              ...$attributes,
              className: $class(
                'class-editor class-card',
                $attributes.className,
              ),
              'data-r-03f428ee': '',
            },
            {
              modelValue: group,
              directions: draft.directions,
              groups: draft.groups,
            },
            { htmlFor: 'group-name-' + group.id },
            {
              id: 'group-name-' + group.id,
              maxLength: 80,
              value: group.name ?? '',
              onChange: $textProperty(() => $state.group.value, 'name'),
            },
            $renderList(group.meetings, (_, index) => (
              <div key={index} className="class-meeting" data-r-03f428ee="">
                <label
                  htmlFor={'group-time-' + group.id + '-' + index}
                  data-r-03f428ee=""
                >
                  {'День и время '}
                  {index + 1}
                </label>
                <div className="class-actions" data-r-03f428ee="">
                  <input
                    id={'group-time-' + group.id + '-' + index}
                    maxLength={120}
                    placeholder="Понедельник, 19:00"
                    value={group.meetings[index] ?? ''}
                    onChange={$textProperty(
                      () => $required($state.group.value).meetings,
                      index,
                    )}
                    data-r-03f428ee=""
                  />
                  {group.meetings.length > 1 ? (
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
                  ) : null}
                </div>
              </div>
            )),
            {
              disabled: group.meetings.length >= 7,
              onClick: () =>
                void $required($state.group.value).meetings.push(''),
            },
            {
              disabled: Boolean(group.review),
              checked: group.enrollmentOpen,
              onChange: $checkboxProperty(
                () => $state.group.value,
                'enrollmentOpen',
              ),
            },
            {
              targetId: group.id,
              onOpenTarget: (type, id) =>
                $unref($state.emit)('openTarget', type, id),
              modelValue: draft,
              onModelValueChange: $setter($state, 'draft'),
            },
            { content: draft, groupId: group.id },
            {
              modelValue: group,
              directions: draft.directions,
              onRemove: $callback(remove),
            },
          )
        : null}
    </>
  );
}
