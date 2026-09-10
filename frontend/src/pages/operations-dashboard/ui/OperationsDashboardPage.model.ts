import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { useTemplateRef, watch } from '@frontend/shared/lib/model-state';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';

import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const intakeControl = useTemplateRef<{
    refresh: () => Promise<void>;
  }>('intakeControl');
  const operatorInbox = useTemplateRef<{
    refresh: () => Promise<void>;
  }>('operatorInbox');
  const {
    deliveryControl,
    deliveryRetry,
    inboundEventResolution,
    operations,
    operatorResolution,
    refreshAll,
    session,
  } = useOperationsDashboard({ intakeControl, operatorInbox });
  watch(
    [session.booting, session.authenticated],
    ([booting, authenticated]) => {
      if (!booting && !authenticated) {
        openAdminLogin('/ops');
      }
    },
    { immediate: true },
  );
  async function logOut(): Promise<void> {
    await session.endSession();
  }
  return {
    intakeControl,
    operatorInbox,
    deliveryControl,
    deliveryRetry,
    inboundEventResolution,
    operations,
    operatorResolution,
    refreshAll,
    session,
    logOut,
  };
}
