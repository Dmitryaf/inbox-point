import { templateRef as $templateRef } from '@frontend/shared/lib/component-view';
import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl';

import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import { renderOperationsDashboardPagePart2 } from './OperationsDashboardPage.part2';
import type { ModelScope } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart1(
  $state: ReturnType<typeof createComponentModel>,
  $scope: ModelScope,
) {
  const { refreshAll } = $state;
  const session = $unref($state.session);
  const operations = $unref($state.operations);
  const deliveryControl = $unref($state.deliveryControl);
  const deliveryRetry = $unref($state.deliveryRetry);

  return (
    <>
      {session.booting.value ? (
        <section className="card loading-card">
          <p>{'Проверяем доступ…'}</p>
        </section>
      ) : !session.authenticated.value ? (
        <section className="auth-panel">
          <div className="auth-stack">
            {session.error.value ? (
              <p role="alert" className="message message--error">
                {session.error.value}
              </p>
            ) : null}
            <AdminLoginForm
              pending={session.pending.value}
              onSubmit={$callback(
                $required($unref($state.session)).authenticate,
              )}
            />
          </div>
        </section>
      ) : (
        <section className="ops-workspace">
          {session.error.value ? (
            <p role="alert" className="message message--error">
              {session.error.value}
            </p>
          ) : null}
          <div className="toolbar">
            <p>{'Состояние обновляется автоматически каждые 30 секунд.'}</p>
            <button
              disabled={operations.loading.value}
              type="button"
              onClick={$nativeHandler(refreshAll)}
              className="secondary-button"
            >
              {operations.loading.value ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
          {operations.error.value ? (
            <p role="alert" className="message message--error">
              {operations.error.value}
            </p>
          ) : null}
          {renderOperationsDashboardPagePart2($state)}
          <ClientIntakeControl
            onChanged={$callback(refreshAll)}
            onUnauthorized={$callback(
              $required($unref($state.session)).expireSession,
            )}
            ref={$templateRef($state, 'intakeControl', $scope)}
          />
          <AsyncMessage kind="error" text={deliveryRetry.error.value} />
          <AsyncMessage kind="success" text={deliveryRetry.notice.value} />
          <AsyncMessage kind="error" text={deliveryControl.error.value} />
          <AsyncMessage kind="success" text={deliveryControl.notice.value} />
          <OperatorInbox
            onUnauthorized={session.expireSession}
            ref={$templateRef($state, 'operatorInbox', $scope)}
          />
        </section>
      )}
    </>
  );
}
