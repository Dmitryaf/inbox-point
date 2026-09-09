import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const {
    deliveryControl,
    deliveryRetry,
    inboundEventResolution,
    intakeControl,
    operations,
    operatorInbox,
    operatorResolution,
    refreshAll,
    session,
  } = useOperationsDashboard();
  return {
    deliveryControl,
    deliveryRetry,
    inboundEventResolution,
    intakeControl,
    operations,
    operatorInbox,
    operatorResolution,
    refreshAll,
    session,
  };
}
