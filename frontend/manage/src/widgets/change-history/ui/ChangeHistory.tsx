import {
  useComponentModel,
  ModelScopeProvider,
} from '@manage/shared/lib/component-model';
import {
  classNames as $class,
  renderList as $renderList,
} from '@manage/shared/lib/component-view';

import { unref as $unref } from '@manage/shared/lib/model-state';

import { inheritedAttributes } from '@manage/shared/lib/component-attributes';

import {
  formatChangeDate,
  formatSections,
} from '@manage/features/restore-content/model/history-format';
import RestoreAction from '@manage/features/restore-content/ui/RestoreAction';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './ChangeHistory.model';

export default function ChangeHistory($incomingProps: ComponentProps) {
  const $attributes = inheritedAttributes($incomingProps);
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { $emit } = $state;

  return (
    <ModelScopeProvider scope={$scope}>
      <section
        {...$attributes}
        aria-labelledby="history-title"
        className={$class('card', $attributes.className)}
      >
        <p className="step">{'История'}</p>
        <h2 id="history-title">{'Предыдущие версии'}</h2>
        {$props.changes.length === 0 ? (
          <p className="empty">{'Изменений пока нет.'}</p>
        ) : (
          <ol className="history-list">
            {$renderList($props.changes, (change, index) => (
              <li key={`${change.changedAt}-${change.revision ?? 'old'}`}>
                <strong>{$unref(formatChangeDate)(change.changedAt)}</strong>
                <span>{$unref(formatSections)(change.sections)}</span>
                {index === 0 ? (
                  <small>{'Текущая версия'}</small>
                ) : change.revision ? (
                  <RestoreAction
                    hasUnsavedChanges={$props.hasUnsavedChanges}
                    pending={$props.restoring}
                    revision={change.revision}
                    onRestore={($event) => {
                      void $emit('restore', $event);
                    }}
                  />
                ) : (
                  <small>{'Старая запись: восстановление недоступно'}</small>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </ModelScopeProvider>
  );
}
