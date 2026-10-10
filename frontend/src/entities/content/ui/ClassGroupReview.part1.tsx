import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClassGroupReview.model';
export function renderClassGroupReviewPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const group = $state.group.value;
  const duplicate = $state.duplicate.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {group.review ? (
        <aside
          {...$attributes}
          className={$class('class-review', $attributes.className)}
          data-r-3333923b=""
        >
          <strong data-r-3333923b="">{'Старое расписание'}</strong>
          <pre data-r-3333923b="">{group.review.source}</pre>
          <p data-r-3333923b="">
            {
              'Заполните название, дни и время занятий ниже, затем включите набор.'
            }
          </p>
          {duplicate ? (
            <div role="alert" data-r-3333923b="">
              <p data-r-3333923b="">
                {' Группа «'}
                {duplicate.name}
                {
                  '» уже есть в этом направлении. Можно открыть её или удалить эту лишнюю запись. '
                }
              </p>
              <button
                type="button"
                onClick={() =>
                  void $unref($state.emit)(
                    'openGroup',
                    $required($state.duplicate.value).id,
                  )
                }
                className="secondary-button"
                data-r-3333923b=""
              >
                {' Открыть существующую группу '}
              </button>
            </div>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
