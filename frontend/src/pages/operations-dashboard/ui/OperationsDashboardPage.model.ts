import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { onBeforeUnmount, ref, watch } from '@frontend/shared/lib/model-state';
import { useOperationsSession } from '@frontend/features/operations-auth/model/use-operations-session';

import { useOutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/model/use-outbound-delivery-control';
import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';
import { useDeliveryRetry } from '@frontend/features/retry-delivery/model/use-delivery-retry';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const refreshIntervalMs = 30000;
  const session = useOperationsSession();
  const operations = useOperationsStatus(session.expireSession);
  const intakeControl = ref<{
    refresh: () => Promise<void>;
  }>();
  const operatorInbox = ref<{
    refresh: () => Promise<void>;
  }>();
  const deliveryRetry = useDeliveryRetry(refreshAll, session.expireSession);
  const deliveryControl = useOutboundDeliveryControl(
    refreshAll,
    session.expireSession,
  );
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  watch(session.authenticated, (authenticated) => {
    stopAutomaticRefresh();
    if (!authenticated) {
      operations.clear();
      return;
    }
    void refreshAll();
    refreshTimer = setInterval(() => {
      void refreshAll();
    }, refreshIntervalMs);
  });
  onBeforeUnmount(stopAutomaticRefresh);
  const authenticate = (password: string) => session.authenticate(password);
  const logout = () => session.endSession();
  async function refreshAll(): Promise<void> {
    await Promise.all([
      operations.refresh(),
      operatorInbox.value?.refresh() ?? Promise.resolve(),
      intakeControl.value?.refresh() ?? Promise.resolve(),
    ]);
  }
  function stopAutomaticRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
  }
  return {
    session,
    operations,
    intakeControl,
    operatorInbox,
    deliveryRetry,
    deliveryControl,
    authenticate,
    logout,
    refreshAll,
  };
}
