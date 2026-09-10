import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import {
  leaveAdminLogin,
  takeAdminLoginMessage,
} from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const session = useAdminSession();
  const loginMessage = ref(takeAdminLoginMessage());
  watch(
    [session.booting, session.authenticated],
    ([booting, authenticated]) => {
      if (!booting && authenticated) {
        leaveAdminLogin();
      }
    },
    { immediate: true },
  );
  async function authenticate(password: string): Promise<void> {
    await session.authenticate(password);
  }
  return { session, loginMessage, authenticate };
}
