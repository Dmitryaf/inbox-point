import { templateRef as $templateRef } from '@frontend/shared/lib/component-view';
import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  requiredValue as $required,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import OperationsLoginForm from '@frontend/features/operations-auth/ui/OperationsLoginForm';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl';

import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage';

import type { ModelScope } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart2(
  $state: ReturnType<typeof createComponentModel>,
  $scope: ModelScope,
) {
  const { refreshAll, authenticate } = $state;
  const session = $unref($state.session);
  const operations = $unref($state.operations);
  const deliveryRetry = $unref($state.deliveryRetry);
  const deliveryControl = $unref($state.deliveryControl);

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
            <OperationsLoginForm
              pending={session.pending.value}
              onSubmit={$callback(authenticate)}
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
          <ClientIntakeControl
            scope="ops"
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
          {operations.status.value ? (
            <OperationsOverview
              deliveryControlPending={deliveryControl.pendingMode.value}
              pendingDeliveryId={$or(
                deliveryRetry.pendingDeliveryId.value,
                () => undefined,
              )}
              status={operations.status.value}
              onChangeDeliveryMode={$callback(
                $required($unref($state.deliveryControl)).change,
              )}
              onRetryDelivery={$callback(
                $required($unref($state.deliveryRetry)).retry,
              )}
            />
          ) : (
            <section className="card loading-card">
              <p>{'Получаем состояние сервиса…'}</p>
            </section>
          )}
        </section>
      )}
    </>
  );
}
