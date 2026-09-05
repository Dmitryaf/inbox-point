import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { useManagementSession } from '@frontend/features/management-auth/model/use-management-session';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useManagementSession();
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
