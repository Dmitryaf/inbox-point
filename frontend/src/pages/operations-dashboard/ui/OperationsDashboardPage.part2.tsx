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
  const session = $unref($state.session);
  const operations = $unref($state.operations);
  const deliveryControl = $unref($state.deliveryControl);
  const deliveryRetry = $unref($state.deliveryRetry);
  const operatorResolution = $unref($state.operatorResolution);
  if (!!session.booting.value) {
    return null;
  }
  if (!!!session.authenticated.value) {
    return null;
  }
  return (
    <>
      {operations.status.value ? (
        <OperationsOverview
          deliveryControlPending={deliveryControl.pendingMode.value}
          pendingDeliveryId={$or(
            deliveryRetry.pendingDeliveryId.value,
            () => undefined,
          )}
          pendingOperatorActionId={$or(
            operatorResolution.pendingActionId.value,
            () => undefined,
          )}
          status={operations.status.value}
          onChangeDeliveryMode={$callback(
            $required($unref($state.deliveryControl)).change,
          )}
          onResolveDelivery={$callback(
            $required($unref($state.deliveryRetry)).resolve,
          )}
          onRetryDelivery={$callback(
            $required($unref($state.deliveryRetry)).retry,
          )}
          onResolveOperatorAction={$callback(
            $required($unref($state.operatorResolution)).resolve,
          )}
        />
      ) : (
        <section className="card loading-card">
          <p>{'Получаем состояние сервиса…'}</p>
        </section>
      )}
    </>
  );
}
