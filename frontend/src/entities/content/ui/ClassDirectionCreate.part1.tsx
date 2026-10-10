import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';

import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';
import { textModel as $textModel } from '@frontend/shared/lib/component-inputs';
import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ClassDirectionCreate.model';
export function renderClassDirectionCreatePart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { add } = $state;
  const directionName = $state.directionName.value;
  const notice = $state.notice.value;
  const draft = $state.draft.value;
  const adding = $state.adding.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {!adding ? (
        <button
          {...$attributes}
          type="button"
          disabled={draft.directions.length >= 20}
          onClick={() => void $set($state, 'adding', true)}
          data-r-7bb6e793=""
        >
          {' Добавить направление '}
        </button>
      ) : (
        <form
          {...$attributes}
          onSubmit={$nativeHandler(add, { prevent: true })}
          className={$class('class-editor', $attributes.className)}
          data-r-7bb6e793=""
        >
          <label htmlFor="new-direction-name" data-r-7bb6e793="">
            {'Новое направление'}
          </label>
          <input
            id="new-direction-name"
            maxLength={80}
            placeholder="Например, Бачата"
            value={directionName ?? ''}
            onChange={$textModel($state, 'directionName')}
            data-r-7bb6e793=""
          />
          <div className="class-actions" data-r-7bb6e793="">
            <button type="submit" data-r-7bb6e793="">
              {'Создать направление'}
            </button>
            <button
              type="button"
              onClick={() => void $set($state, 'adding', false)}
              className="secondary-button"
              data-r-7bb6e793=""
            >
              {' Отмена '}
            </button>
          </div>
          {notice ? (
            <p role="status" data-r-7bb6e793="">
              {notice}
            </p>
          ) : null}
        </form>
      )}
    </>
  );
}
