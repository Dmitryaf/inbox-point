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

import ClassKeywordsEditor from './ClassKeywordsEditor';

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
  const { add, remove } = $state;
  const groups = $state.groups.value;
  const draft = $state.draft.value;
  const direction = $state.direction.value;
  const notice = $state.notice.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {direction ? (
        <div
          {...$attributes}
          className={$class('class-editor', $attributes.className)}
          data-r-71dc3e8a=""
        >
          {!groups.length ? (
            <p data-r-71dc3e8a="">{'Добавьте группу и укажите расписание.'}</p>
          ) : null}
          {$renderList(groups, (group) => (
            <button
              key={group.id}
              type="button"
              onClick={() =>
                void $unref($state.emit)('openTarget', 'group', group.id)
              }
              className="class-list-item"
              data-r-71dc3e8a=""
            >
              <strong data-r-71dc3e8a="">
                {$or(group.name, () => 'Новая группа')}
              </strong>
              <small data-r-71dc3e8a="">
                {group.review
                  ? 'Заполните данные группы'
                  : group.enrollmentOpen
                    ? 'Набор открыт'
                    : 'Набор закрыт'}
              </small>
            </button>
          ))}
          <button
            type="button"
            disabled={
              draft.groups.filter((group) => !group.review).length >= 60
            }
            onClick={$nativeHandler(add)}
            data-r-71dc3e8a=""
          >
            {' Добавить группу '}
          </button>
          <ClassKeywordsEditor
            targetType="direction"
            targetId={direction.id}
            onOpenTarget={(type, id) =>
              $unref($state.emit)('openTarget', type, id)
            }
            modelValue={draft}
            onModelValueChange={$setter($state, 'draft')}
            data-r-71dc3e8a=""
          />
          <details className="class-card" data-r-71dc3e8a="">
            <summary data-r-71dc3e8a="">{'Настройки направления'}</summary>
            <label htmlFor={'direction-' + direction.id} data-r-71dc3e8a="">
              {'Название направления'}
            </label>
            <input
              id={'direction-' + direction.id}
              maxLength={80}
              value={direction.name ?? ''}
              onChange={$textProperty(() => $state.direction.value, 'name')}
              data-r-71dc3e8a=""
            />
            <button
              type="button"
              onClick={$nativeHandler(remove)}
              className="danger"
              data-r-71dc3e8a=""
            >
              {' Удалить направление '}
            </button>
            {notice ? (
              <p role="status" data-r-71dc3e8a="">
                {notice}
              </p>
            ) : null}
          </details>
        </div>
      ) : null}
    </>
  );
}
