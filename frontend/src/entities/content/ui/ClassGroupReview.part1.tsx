import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';

import { textProperty as $textProperty } from '@frontend/shared/lib/component-inputs';
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
  const { confirm } = $state;
  const group = $state.group.value;
  const notice = $state.notice.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {group.review ? (
        <aside
          {...$attributes}
          className={$class('class-review', $attributes.className)}
          data-r-3333923b=""
        >
          <strong data-r-3333923b="">{'Нужно проверить'}</strong>
          <p data-r-3333923b="">
            {
              ' Проверьте исходную запись и заполните поля группы ниже. До подтверждения клиентам доступен этот текст, без записи на занятие. '
            }
          </p>
          <pre data-r-3333923b="">{group.review.source}</pre>
          <label htmlFor={'review-direction-' + group.id} data-r-3333923b="">
            {'Направление'}
          </label>
          <select
            id={'review-direction-' + group.id}
            value={group.directionId ?? ''}
            onChange={$textProperty(() => $state.group.value, 'directionId')}
            data-r-3333923b=""
          >
            <option value="" data-r-3333923b="">
              {'Выберите направление'}
            </option>
            {$renderList($props.directions, (item) => (
              <option key={item.id} value={item.id} data-r-3333923b="">
                {item.name}
              </option>
            ))}
          </select>
          {!$props.directions.length ? (
            <p data-r-3333923b="">
              {' Сначала добавьте направление на экране «Занятия». '}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void confirm($props.directions)}
            data-r-3333923b=""
          >
            {' Подтвердить данные '}
          </button>
          {notice ? (
            <p role="status" data-r-3333923b="">
              {notice}
            </p>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
