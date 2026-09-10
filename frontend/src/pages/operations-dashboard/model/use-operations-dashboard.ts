import { onBeforeUnmount, watch, type ShallowRef } from 'vue';

import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import { useOutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/model/use-outbound-delivery-control';
import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';
import { useDeliveryRetry } from '@frontend/features/retry-delivery/model/use-delivery-retry';
import { useInboundEventResolution } from '@frontend/features/resolve-inbound-event/model/use-inbound-event-resolution';
import { useOperatorActionResolution } from '@frontend/features/resolve-operator-action/model/use-operator-action-resolution';

const refreshIntervalMs = 30_000;

interface RefreshableComponent {
  refresh(): Promise<void>;
}

interface OperationsDashboardRefreshTargets {
  intakeControl: Readonly<ShallowRef<RefreshableComponent | null>>;
  operatorInbox: Readonly<ShallowRef<RefreshableComponent | null>>;
}

export function useOperationsDashboard(
  refreshTargets: OperationsDashboardRefreshTargets,
) {
  const session = useAdminSession();
  const operations = useOperationsStatus(session.expireSession);
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
      refreshTargets.operatorInbox.value?.refresh() ?? Promise.resolve(),
      refreshTargets.intakeControl.value?.refresh() ?? Promise.resolve(),
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
    operations,
    operatorResolution,
    refreshAll,
    session,
  };
}
