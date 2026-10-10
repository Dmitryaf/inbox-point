import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  modelSetter as $setter,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';
import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import { addClassGroup } from '@frontend/entities/content/model/class-editor';
import ClassGroupEditor from './ClassGroupEditor';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClassDirectionEditor.model';
export function renderClassDirectionEditorPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { remove } = $state;
  const direction = $state.direction.value;
  const groups = $state.groups.value;
  const draft = $state.draft.value;
  const notice = $state.notice.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {direction ? (
        <details
          {...$attributes}
          open
          className={$class('class-card', $attributes.className)}
          data-r-71dc3e8a=""
        >
          <summary data-r-71dc3e8a="">
            <strong data-r-71dc3e8a="">
              {$or(direction.name, () => 'Новое направление')}
            </strong>
            {' · '}
            {groups.length}
            {' групп '}
          </summary>
          <label htmlFor={`direction-${direction.id}`} data-r-71dc3e8a="">
            {'Название направления'}
          </label>
          <input
            id={`direction-${direction.id}`}
            maxLength={80}
            value={direction.name ?? ''}
            onChange={$textProperty(() => $state.direction.value, 'name')}
            data-r-71dc3e8a=""
          />
          {$renderList(groups, (group) => (
            <ClassGroupEditor
              key={group.id}
              groupId={group.id}
              modelValue={draft}
              onModelValueChange={$setter($state, 'draft')}
              data-r-71dc3e8a=""
            />
          ))}
          <div className="class-actions" data-r-71dc3e8a="">
            <button
              type="button"
              disabled={draft.groups.length >= 60}
              onClick={() =>
                void $unref(addClassGroup)(
                  $state.draft.value,
                  $props.directionId,
                )
              }
              data-r-71dc3e8a=""
            >
              {' Добавить группу '}
            </button>
            <button
              type="button"
              onClick={$nativeHandler(remove)}
              className="danger"
              data-r-71dc3e8a=""
            >
              {' Удалить направление '}
            </button>
          </div>
          {notice ? (
            <p role="status" data-r-71dc3e8a="">
              {notice}
            </p>
          ) : null}
        </details>
      ) : null}
    </>
  );
}
