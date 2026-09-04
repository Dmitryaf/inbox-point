import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';

import { unref as $unref } from '@manage/shared/lib/model-state';
import { setModelValue as $set } from '@manage/shared/lib/component-bindings';

import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './RestoreAction.model';

export default function RestoreAction($incomingProps: ComponentProps) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { props } = $state;
  const confirming = $state.confirming.value;
  return (
    <ModelScopeProvider scope={$scope}>
      {confirming ? (
        <div className="restore-confirm">
          <p>{'Заменить текущую информацию этой версией?'}</p>
          {$props.hasUnsavedChanges ? (
            <p className="warning-text">
              {' Несохранённые изменения будут потеряны. '}
            </p>
          ) : null}
          <button
            disabled={$props.pending}
            type="button"
            onClick={() => {
              void $unref($state.emit)('restore', props.revision);
            }}
          >
            {$props.pending ? 'Восстанавливаем…' : 'Да, восстановить'}
          </button>
          <button
            disabled={$props.pending}
            type="button"
            onClick={() => {
              void $set($state, 'confirming', false);
            }}
            className="quiet"
          >
            {' Отмена '}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            void $set($state, 'confirming', true);
          }}
          className="quiet"
        >
          {' Восстановить '}
        </button>
      )}
    </ModelScopeProvider>
  );
}
