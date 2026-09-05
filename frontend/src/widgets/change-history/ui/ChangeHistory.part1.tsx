import { renderList as $renderList } from '@frontend/shared/lib/component-view';

import { unref as $unref } from '@frontend/shared/lib/model-state';

import {
  formatChangeDate,
  formatSections,
} from '@frontend/features/restore-content/model/history-format';
import RestoreAction from '@frontend/features/restore-content/ui/RestoreAction';

import type { WithDefaults } from '@frontend/shared/lib/component-model';
import type {
  createComponentModel,
  ComponentProps,
  componentDefaults,
} from './ChangeHistory.model';
export function renderChangeHistoryPart1(
  $state: ReturnType<typeof createComponentModel>,
  $props: WithDefaults<ComponentProps, typeof componentDefaults>,
) {
  const { $emit } = $state;
  return (
    <>
      {$props.loading ? (
        <p role="status" className="empty">
          {'Обновляем историю…'}
        </p>
      ) : $props.changes.length === 0 ? (
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
    </>
  );
}
