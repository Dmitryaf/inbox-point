import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import { ref, watch } from '@frontend/shared/lib/model-state';
import { useRouter } from '@frontend/shared/lib/router';
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
  const router = useRouter();
  watch(
    [session.booting, session.authenticated],
    ([booting, authenticated]) => {
      if (!booting && authenticated) {
        leaveAdminLogin(router);
      }
    },
    { immediate: true },
  );
  async function authenticate(password: string): Promise<void> {
    await session.authenticate(password);
  }
  return { session, loginMessage, authenticate };
}
