import {
  invokeHandler as $invoke,
  invokeArgs as $invokeArgs,
} from '@ops/shared/lib/component-events';
import { unref as $unref } from '@ops/shared/lib/model-state';
import { requiredValue as $required } from '@ops/shared/lib/component-bindings';

import OperationsLoginForm from '@ops/features/authenticate/ui/OperationsLoginForm';

import OperationsOverview from '@ops/widgets/operations-overview/ui/OperationsOverview';

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
        <OperationsLoginForm
          pending={session.pending.value}
          onSubmit={(...$args) => {
            $invokeArgs(authenticate, $args);
          }}
        />
      ) : (
        <>
          <div className="toolbar">
            <p>{'Состояние обновляется автоматически каждые 30 секунд.'}</p>
            <button
              disabled={operations.loading.value}
              type="button"
              onClick={($event) => {
                $invoke($required($unref($state.operations)).refresh, $event);
              }}
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
          {operations.status.value ? (
            <OperationsOverview status={operations.status.value} />
          ) : (
            <section className="card loading-card">
              <p>{'Получаем состояние сервиса…'}</p>
            </section>
          )}
        </>
      )}
    </>
  );
}
