import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
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

import ClassEnrollmentSettings from './ClassEnrollmentSettings';
import ClassGroupReview from './ClassGroupReview';
import ClassGroupSettings from './ClassGroupSettings';
import ClassKeywordsEditor from './ClassKeywordsEditor';

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
      {group ? (
        <div
          {...$attributes}
          className={$class('class-editor class-card', $attributes.className)}
          data-r-03f428ee=""
        >
          <ClassGroupReview
            modelValue={group}
            directions={draft.directions}
            groups={draft.groups}
            data-r-03f428ee=""
          />
          <label htmlFor={'group-name-' + group.id} data-r-03f428ee="">
            {'Название группы'}
          </label>
          <input
            id={'group-name-' + group.id}
            maxLength={80}
            placeholder="Например, Начинающие"
            value={group.name ?? ''}
            onChange={$textProperty(() => $state.group.value, 'name')}
            data-r-03f428ee=""
          />
          <label htmlFor={'group-time-' + group.id + '-0'} data-r-03f428ee="">
            {'Дни и время занятий'}
          </label>
          <textarea
            id={'group-time-' + group.id + '-0'}
            rows={2}
            aria-describedby="class-schedule-hint"
            placeholder="Пн/Ср — 20:00 или Пн 20:00, Ср 19:00"
            value={schedule ?? ''}
            onChange={$textModel($state, 'schedule')}
            data-r-03f428ee=""
          />
          <p id="class-schedule-hint" className="class-hint" data-r-03f428ee="">
            {
              ' Укажите все дни и время в одном поле. Например, Пн/Ср — 20:00 или Пн 20:00, Ср 19:00. '
            }
          </p>
          <ClassEnrollmentSettings
            modelValue={group}
            onModelValueChange={$setter($state, 'group')}
            data-r-03f428ee=""
          />
          <ClassKeywordsEditor
            targetType="group"
            targetId={group.id}
            onOpenTarget={(type, id) =>
              $unref($state.emit)('openTarget', type, id)
            }
            modelValue={draft}
            onModelValueChange={$setter($state, 'draft')}
            data-r-03f428ee=""
          />
          <div className="class-actions" data-r-03f428ee="">
            <button
              type="button"
              onClick={() =>
                void $unref($state.emit)(
                  'preview',
                  'classes:group:' + $required($state.group.value).id,
                )
              }
              className="secondary-button"
              data-r-03f428ee=""
            >
              {' Посмотреть как клиент '}
            </button>
          </div>
          <ClassGroupSettings
            modelValue={group}
            directions={draft.directions}
            onRemove={$callback(remove)}
            data-r-03f428ee=""
          />
        </div>
      ) : null}
    </>
  );
}
