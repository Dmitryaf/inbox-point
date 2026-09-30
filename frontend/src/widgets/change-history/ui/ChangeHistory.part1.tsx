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
        <p role="status" className="empty" data-r-1c9d9933="">
          {'Обновляем историю…'}
        </p>
      ) : $props.changes.length === 0 ? (
        <p className="empty" data-r-1c9d9933="">
          {'Изменений пока нет.'}
        </p>
      ) : (
        <ol className="history-list" data-r-1c9d9933="">
          {$renderList($props.changes, (change, index) => (
            <li
              key={`${change.changedAt}-${change.revision ?? 'old'}`}
              data-r-1c9d9933=""
            >
              <strong data-r-1c9d9933="">
                {$unref(formatChangeDate)(change.changedAt)}
              </strong>
              {change.revision ? (
                <span data-r-1c9d9933="">
                  {'Версия '}
                  {change.revision}
                </span>
              ) : null}
              <span data-r-1c9d9933="">
                {$unref(formatSections)(change.sections)}
              </span>
              {index === 0 ? (
                <small data-r-1c9d9933="">{'Текущая версия'}</small>
              ) : change.revision ? (
                <RestoreAction
                  hasUnsavedChanges={$props.hasUnsavedChanges}
                  pending={$props.restoring}
                  revision={change.revision}
                  onRestore={($event) => void $emit('restore', $event)}
                  onUnauthorized={() => void $emit('unauthorized')}
                  data-r-1c9d9933=""
                />
              ) : (
                <small data-r-1c9d9933="">
                  {'Старая запись: восстановление недоступно'}
                </small>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
