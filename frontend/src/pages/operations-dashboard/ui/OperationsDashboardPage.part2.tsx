import { eventCallback as $callback } from '@frontend/shared/lib/component-events';
import { unref as $unref } from '@frontend/shared/lib/model-state';
import {
  requiredValue as $required,
  logicalOr as $or,
} from '@frontend/shared/lib/component-bindings';

import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview';

import type { createComponentModel } from './OperationsDashboardPage.model';
export function renderOperationsDashboardPagePart2(
  $state: ReturnType<typeof createComponentModel>,
) {
  const operations = $unref($state.operations);
  const session = $unref($state.session);
  const deliveryRetry = $unref($state.deliveryRetry);
  const operatorResolution = $unref($state.operatorResolution);
  const inboundEventResolution = $unref($state.inboundEventResolution);
  if (!session.authenticated.value) {
    return null;
  }
  return (
    <>
      {operations.status.value ? (
        <OperationsOverview
          pendingDeliveryId={$or(
            deliveryRetry.pendingDeliveryId.value,
            () => undefined,
          )}
          pendingOperatorActionId={$or(
            operatorResolution.pendingActionId.value,
            () => undefined,
          )}
          pendingInboundEventId={$or(
            inboundEventResolution.pendingEventId.value,
            () => undefined,
          )}
          status={operations.status.value}
          statusUnavailable={Boolean(operations.error.value)}
          onResolveDelivery={$callback(
            $required($unref($state.deliveryRetry)).resolve,
          )}
          onRetryDelivery={$callback(
            $required($unref($state.deliveryRetry)).retry,
          )}
          onResolveOperatorAction={$callback(
            $required($unref($state.operatorResolution)).resolve,
          )}
          onResolveInboundEvent={$callback(
            $required($unref($state.inboundEventResolution)).resolve,
          )}
          data-r-fef838bc=""
        />
      ) : (
        <section role="status" className="card loading-card" data-r-fef838bc="">
          <p data-r-fef838bc="">{'Проверяем работу каналов…'}</p>
        </section>
      )}
    </>
  );
}
