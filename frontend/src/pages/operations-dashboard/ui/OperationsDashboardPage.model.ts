import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { onBeforeUnmount, watch } from '@frontend/shared/lib/model-state';
import { useOperationsSession } from '@frontend/features/operations-auth/model/use-operations-session';

import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const refreshIntervalMs = 30_000;
  const session = useOperationsSession();
  const operations = useOperationsStatus(session.expireSession);
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  watch(session.authenticated, (authenticated) => {
    stopAutomaticRefresh();
    if (!authenticated) {
      operations.clear();
      return;
    }
    void operations.refresh();
    refreshTimer = setInterval(() => {
      void operations.refresh();
    }, refreshIntervalMs);
  });
  onBeforeUnmount(stopAutomaticRefresh);
  async function authenticate(password: string): Promise<void> {
    await session.authenticate(password);
  }
  async function logout(): Promise<void> {
    await session.endSession();
  }
  function stopAutomaticRefresh(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
  }
  return { session, operations, authenticate, logout };
}
