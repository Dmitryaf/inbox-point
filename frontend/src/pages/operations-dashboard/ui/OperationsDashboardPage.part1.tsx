import {
  eventCallback as $callback,
  nativeHandler as $nativeHandler,
} from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import OperationsLoginForm from '@frontend/features/operations-auth/ui/OperationsLoginForm';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl';

import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart1(
  $state: ReturnType<typeof createComponentModel>,
) {
  const { authenticate } = $state;
  const session = $unref($state.session);
  const operations = $unref($state.operations);
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
              onClick={$nativeHandler(
                $required($unref($state.operations)).refresh,
              )}
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
            onChanged={$callback($required($unref($state.operations)).refresh)}
            onUnauthorized={$callback(
              $required($unref($state.session)).expireSession,
            )}
          />
          {operations.status.value ? (
            <OperationsOverview status={operations.status.value} />
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
