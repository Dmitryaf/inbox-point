import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ShallowRef,
} from 'vue';

import type { AdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import { useOutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/model/use-outbound-delivery-control';
import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';
import { useDeliveryRetry } from '@frontend/features/retry-delivery/model/use-delivery-retry';
import { useInboundEventResolution } from '@frontend/features/resolve-inbound-event/model/use-inbound-event-resolution';
import { useOperatorActionResolution } from '@frontend/features/resolve-operator-action/model/use-operator-action-resolution';

const refreshIntervalMs = 30_000;

interface RefreshableComponent {
  refresh(): Promise<string>;
}

interface OperationsDashboardRefreshTargets {
  intakeControl: Readonly<ShallowRef<RefreshableComponent | null>>;
  operatorInbox: Readonly<ShallowRef<RefreshableComponent | null>>;
  session: AdminSession;
}

export function useOperationsDashboard(
  refreshTargets: OperationsDashboardRefreshTargets,
) {
  const session = refreshTargets.session;
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
  const refreshError = ref('');
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let mounted = false;

  watch(session.authenticated, (authenticated) => {
    if (!mounted) {
      return;
    }
    stopAutomaticRefresh();
    if (!authenticated) {
      operations.clear();
      refreshError.value = '';
      return;
    }
    startAutomaticRefresh();
  });
  onMounted(() => {
    mounted = true;
    if (session.authenticated.value) {
      startAutomaticRefresh();
    }
  });
  onBeforeUnmount(stopAutomaticRefresh);

  async function refreshAll(): Promise<void> {
    await nextTick();
    const intakeControl = refreshTargets.intakeControl.value;
    const failures = await Promise.all([
      operations.refresh(),
      refreshTargets.operatorInbox.value?.refresh() ?? Promise.resolve(''),
      intakeControl?.refresh() ?? Promise.resolve(''),
    ]);
    if (!intakeControl && operations.status.value) {
      await nextTick();
      failures.push(
        (await refreshTargets.intakeControl.value?.refresh()) ?? '',
      );
    }
    refreshError.value = failures.find(Boolean) ?? '';
  }

  function startAutomaticRefresh(): void {
    void refreshAll();
    refreshTimer = setInterval(() => void refreshAll(), refreshIntervalMs);
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
    refreshError,
    refreshAll,
    session,
  };
}
