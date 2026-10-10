import {
  classNames as $class,
  renderList as $renderList,
} from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { logicalOr as $or } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './LegacyScheduleAssignment.model';
export function renderLegacyScheduleAssignmentPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { transfer } = $state;
  const index = $state.index.value;
  const draft = $state.draft.value;
  const directionId = $state.directionId.value;
  const notice = $state.notice.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {draft.schedule.length ? (
        <details
          {...$attributes}
          className={$class('class-card', $attributes.className)}
          data-r-92fb3f88=""
        >
          <summary data-r-92fb3f88="">
            {'Перенести старую карточку в группу'}
          </summary>
          <label htmlFor="legacy-class-item" data-r-92fb3f88="">
            {'Карточка'}
          </label>
          <select
            id="legacy-class-item"
            value={index ?? ''}
            onChange={$textModel($state, 'index')}
            data-r-92fb3f88=""
          >
            {$renderList(draft.schedule, (item, position) => (
              <option key={position} value={position} data-r-92fb3f88="">
                {$or(item.title, () => `Карточка ${position + 1}`)}
              </option>
            ))}
          </select>
          <label htmlFor="legacy-class-direction" data-r-92fb3f88="">
            {'Направление'}
          </label>
          <select
            id="legacy-class-direction"
            value={directionId ?? ''}
            onChange={$textModel($state, 'directionId')}
            data-r-92fb3f88=""
          >
            <option value="" data-r-92fb3f88="">
              {'Выберите направление'}
            </option>
            {$renderList(draft.directions, (direction) => (
              <option
                key={direction.id}
                value={direction.id}
                data-r-92fb3f88=""
              >
                {direction.name}
              </option>
            ))}
          </select>
          <p data-r-92fb3f88="">
            {
              ' Название, время и описание перейдут в группу. Старая карточка будет заменена этой группой после сохранения. Набор сначала закрыт. '
            }
          </p>
          <button
            type="button"
            disabled={!directionId}
            onClick={$nativeHandler(transfer)}
            data-r-92fb3f88=""
          >
            {' Перенести в группу '}
          </button>
          {notice ? (
            <p role="status" data-r-92fb3f88="">
              {notice}
            </p>
          ) : null}
        </details>
      ) : null}
    </>
  );
}
