import { onBeforeUnmount, ref, watch } from 'vue';

import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import { useOutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/model/use-outbound-delivery-control';
import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';
import { useDeliveryRetry } from '@frontend/features/retry-delivery/model/use-delivery-retry';
import { useInboundEventResolution } from '@frontend/features/resolve-inbound-event/model/use-inbound-event-resolution';
import { useOperatorActionResolution } from '@frontend/features/resolve-operator-action/model/use-operator-action-resolution';

const refreshIntervalMs = 30_000;

export function useOperationsDashboard() {
  const session = useAdminSession();
  const operations = useOperationsStatus(session.expireSession);
  const intakeControl = ref<{ refresh: () => Promise<void> }>();
  const operatorInbox = ref<{ refresh: () => Promise<void> }>();
  const deliveryRetry = useDeliveryRetry(refreshAll, session.expireSession);
  const inboundEventResolution = useInboundEventResolution(
    refreshAll,
    session.expireSession,
  );
  const operatorResolution = useOperatorActionResolution(
    refreshAll,
    session.expireSession,
  );
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
    refreshTimer = setInterval(() => void refreshAll(), refreshIntervalMs);
  });
  onBeforeUnmount(stopAutomaticRefresh);

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
