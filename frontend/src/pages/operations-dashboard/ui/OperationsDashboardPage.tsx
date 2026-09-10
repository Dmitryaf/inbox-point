import '@frontend/pages/operations-dashboard/styles/operations-dashboard-page.react-data-r-fef838bc.css';
import {
  useComponentModel,
  ModelScopeProvider,
} from '@frontend/shared/lib/component-model';
import { classNames as $class } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';

import { inheritedAttributes } from '@frontend/shared/lib/component-attributes';

import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader';

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
  const { logOut } = $state;
  const session = $unref($state.session);
  const $attributes = inheritedAttributes($props);
  return (
    <ModelScopeProvider scope={$scope}>
      <main
        {...$attributes}
        className={$class('ops-shell', $attributes.className)}
        data-r-fef838bc=""
      >
        {session.authenticated.value ? (
          <AdminPageHeader
            authenticated={session.authenticated.value}
            current="status"
            intro="Проверьте, работают ли каналы и доходят ли ответы."
            title="Состояние"
            onLogout={$callback(logOut)}
            data-r-fef838bc=""
          />
        ) : null}
        {renderOperationsDashboardPagePart1($state, $scope)}
      </main>
    </ModelScopeProvider>
  );
}
