import { classNames as $class } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';
import { setModelValue as $set } from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './RestoreAction.model';
export function renderRestoreActionPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { props } = $state;
  const confirming = $state.confirming.value;
  const $attributes = inheritedAttributes($props);

  return (
    <>
      {confirming ? (
        <div
          {...$attributes}
          className={$class('restore-confirm', $attributes.className)}
          data-r-b537467e=""
        >
          <p data-r-b537467e="">
            {'Заменить текущую информацию этой версией?'}
          </p>
          {$props.hasUnsavedChanges ? (
            <p className="warning-text" data-r-b537467e="">
              {' Несохранённые изменения будут потеряны. '}
            </p>
          ) : null}
          <button
            disabled={$props.pending}
            type="button"
            onClick={() => void $unref($state.emit)('restore', props.revision)}
            data-r-b537467e=""
          >
            {$props.pending ? 'Восстанавливаем…' : 'Да, восстановить'}
          </button>
          <button
            disabled={$props.pending}
            type="button"
            onClick={() => void $set($state, 'confirming', false)}
            className="quiet"
            data-r-b537467e=""
          >
            {' Отмена '}
          </button>
        </div>
      ) : (
        <button
          {...$attributes}
          type="button"
          onClick={() => void $set($state, 'confirming', true)}
          className={$class('quiet', $attributes.className)}
          data-r-b537467e=""
        >
          {' Восстановить '}
        </button>
      )}
    </>
  );
}
