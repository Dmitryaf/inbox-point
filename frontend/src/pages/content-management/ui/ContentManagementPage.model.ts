import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref } from '@frontend/shared/lib/model-state';
import { useManagementSession } from '@frontend/features/management-auth/model/use-management-session';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useManagementSession();
  const hasUnsavedChanges = ref(false);
  async function logOut(): Promise<void> {
    if (
      hasUnsavedChanges.value &&
      !window.confirm('Выйти без сохранения изменений?')
    ) {
      return;
    }
    await session.endSession();
  }
  return { session, hasUnsavedChanges, logOut };
}
