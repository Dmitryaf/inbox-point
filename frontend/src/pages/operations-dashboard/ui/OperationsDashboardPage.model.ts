import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { useTemplateRef } from '@frontend/shared/lib/model-state';
import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const intakeControl = useTemplateRef<{
    refresh: () => Promise<string>;
  }>('intakeControl');
  const operatorInbox = useTemplateRef<{
    refresh: () => Promise<string>;
  }>('operatorInbox');
  const session = useAdminShellSession();
  const {
    deliveryControl,
    deliveryRetry,
    inboundEventResolution,
    operations,
    operatorResolution,
    refreshError,
    refreshAll,
  } = useOperationsDashboard({ intakeControl, operatorInbox, session });
  return {
    intakeControl,
    operatorInbox,
    session,
    deliveryControl,
    deliveryRetry,
    inboundEventResolution,
    operations,
    operatorResolution,
    refreshError,
    refreshAll,
  };
}
