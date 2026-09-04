import {
  useComponentModel,
  ModelScopeProvider,
} from '@ops/shared/lib/component-model';
import { classNames as $class } from '@ops/shared/lib/component-view';
import {
  invokeHandler as $invoke,
  invokeArgs as $invokeArgs,
} from '@ops/shared/lib/component-events';
import { unref as $unref } from '@ops/shared/lib/model-state';
import { requiredValue as $required } from '@ops/shared/lib/component-bindings';
import { inheritedAttributes } from '@ops/shared/lib/component-attributes';

import OperationsLoginForm from '@ops/features/authenticate/ui/OperationsLoginForm';

import OperationsOverview from '@ops/widgets/operations-overview/ui/OperationsOverview';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsDashboardPage.model';

export default function OperationsDashboardPage(
  $incomingProps: ComponentProps,
) {
  const $attributes = inheritedAttributes($incomingProps);
  const { state: $state, scope: $scope } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { logout, authenticate } = $state;
  const session = $unref($state.session);
  const operations = $unref($state.operations);

  return (
    <ModelScopeProvider scope={$scope}>
      <main
        {...$attributes}
        className={$class('page-shell', $attributes.className)}
      >
        <header className="page-header">
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
              onClick={($event) => {
                $invoke(logout, $event);
              }}
              className="secondary-button"
            >
              {' Выйти '}
            </button>
          ) : null}
        </header>
        {session.error.value ? (
          <p role="alert" className="message message--error">
            {session.error.value}
          </p>
        ) : null}
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
      </main>
    </ModelScopeProvider>
  );
}
