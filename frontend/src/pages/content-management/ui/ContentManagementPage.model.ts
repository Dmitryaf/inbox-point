import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useAdminSession();
  const hasUnsavedChanges = ref(false);
  const workspaceActivated = ref(false);
  watch(
    [session.booting, session.authenticated],
    ([booting, authenticated]) => {
      if (!booting && !authenticated) {
        workspaceActivated.value = false;
        hasUnsavedChanges.value = false;
        openAdminLogin('/manage');
        return;
      }
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
  }
  return { session, hasUnsavedChanges, workspaceActivated, logOut };
}
