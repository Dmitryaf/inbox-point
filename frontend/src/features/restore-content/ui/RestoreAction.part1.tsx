import { classNames as $class } from '@frontend/shared/lib/component-view';
import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  setModelValue as $set,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import ContentRevision from '@frontend/entities/content/ui/ContentRevision';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

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
  const { review, props } = $state;
  const loading = $state.loading.value;
  const error = $state.error.value;
  const snapshot = $state.snapshot.value;
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
          {loading ? (
            <p role="status" data-r-b537467e="">
              {'Загружаем версию…'}
            </p>
          ) : null}
          <AsyncMessage kind="error" text={error} data-r-b537467e="" />
          {error ? (
            <button
              type="button"
              onClick={$nativeHandler(review)}
              className="quiet"
              data-r-b537467e=""
            >
              {' Повторить загрузку версии '}
            </button>
          ) : null}
          {snapshot ? (
            <ContentRevision snapshot={snapshot} data-r-b537467e="" />
          ) : null}
          <p data-r-b537467e="">
            {
              ' Заменить все разделы, включая скрытые, этой версией? После восстановления информация сразу появится в Telegram и VK. '
            }
          </p>
          {$props.hasUnsavedChanges ? (
            <p className="warning-text" data-r-b537467e="">
              {' Несохранённые изменения будут потеряны. '}
            </p>
          ) : null}
          <button
            disabled={$or(
              $or($props.pending, () => loading),
              () => !snapshot,
            )}
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
          disabled={$props.pending}
          onClick={$nativeHandler(review)}
          className={$class('quiet', $attributes.className)}
          data-r-b537467e=""
        >
          {' Посмотреть версию '}
        </button>
      )}
    </>
  );
}
