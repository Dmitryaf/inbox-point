import { templateRef as $templateRef } from '@frontend/shared/lib/component-view';
import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import { requiredValue as $required } from '@frontend/shared/lib/component-bindings';

import MessageFlowControl from '@frontend/widgets/message-flow-control/ui/MessageFlowControl';

import type { ModelScope } from '@frontend/shared/lib/model-state';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart3(
  $state: ReturnType<typeof createComponentModel>,
  $scope: ModelScope,
) {
  const operations = $unref($state.operations);
  const session = $unref($state.session);
  const deliveryControl = $unref($state.deliveryControl);
  if (!session.authenticated.value) {
    return null;
  }
  return (
    <>
      {operations.status.value ? (
        <MessageFlowControl
          outbound={operations.status.value.outbound}
          outboundPending={deliveryControl.pendingMode.value}
          onChanged={$callback($unref($state.refreshAll))}
          onChangeDeliveryMode={$callback(
            $required($unref($state.deliveryControl)).change,
          )}
          onUnauthorized={$callback(
            $required($unref($state.session)).expireSession,
          )}
          ref={$templateRef($state, 'intakeControl', $scope)}
          data-r-fef838bc=""
        />
      ) : null}
    </>
  );
}
