import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useAdminSession();
  const hasUnsavedChanges = ref(false);
  const workspaceActivated = ref(false);
  watch(
    session.authenticated,
    (authenticated) => {
      if (authenticated) {
        workspaceActivated.value = true;
      }
    },
    { immediate: true },
  );
  async function logOut(): Promise<void> {
    if (
      hasUnsavedChanges.value &&
      !window.confirm('Выйти без сохранения изменений?')
    ) {
      return;
    }
    await session.endSession();
    if (!session.authenticated.value) {
      workspaceActivated.value = false;
      hasUnsavedChanges.value = false;
    }
  }
  return { session, hasUnsavedChanges, workspaceActivated, logOut };
}
