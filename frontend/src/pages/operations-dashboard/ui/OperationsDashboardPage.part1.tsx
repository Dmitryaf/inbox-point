import { nativeHandler as $nativeHandler } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { logout } = $state;
  const session = $unref($state.session);

  return (
    <>
      <header className="ops-header">
        <div>
          <p className="brand">{'MESSENGER HANDOFF'}</p>
          <h1>{'Состояние сервиса'}</h1>
          <p className="page-intro">
            {' Проверяйте подключения и доставку ответов школы. '}
          </p>
        </div>
        {session.authenticated.value ? (
          <button
            type="button"
            onClick={$nativeHandler(logout)}
            className="secondary-button"
          >
            {' Выйти '}
          </button>
        ) : null}
      </header>
    </>
  );
}
