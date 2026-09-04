import {
  useComponentModel,
  ModelScopeProvider,
} from '@ops/shared/lib/component-model';
import { classNames as $class } from '@ops/shared/lib/component-view';
import { invokeHandler as $invoke } from '@ops/shared/lib/component-events';
import { unref as $unref } from '@ops/shared/lib/model-state';

import { inheritedAttributes } from '@ops/shared/lib/component-attributes';

import { renderOperationsDashboardPagePart1 } from './OperationsDashboardPage.part1';
import {
  createComponentModel,
  componentDefaults,
  type ComponentProps,
} from './OperationsDashboardPage.model';

export default function OperationsDashboardPage(
  $incomingProps: ComponentProps,
) {
  const {
    state: $state,
    props: $props,
    scope: $scope,
  } = useComponentModel(
    $incomingProps,
    componentDefaults,
    createComponentModel,
  );
  const { logout } = $state;
  const session = $unref($state.session);
  const $attributes = inheritedAttributes($props);
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
        {renderOperationsDashboardPagePart1($state)}
      </main>
    </ModelScopeProvider>
  );
}
