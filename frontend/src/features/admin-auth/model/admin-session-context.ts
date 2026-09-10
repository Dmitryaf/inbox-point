import { inject, provide, type InjectionKey } from 'vue';

import {
  useAdminSession,
  type AdminSession,
} from '@frontend/features/admin-auth/model/use-admin-session';

const adminSessionKey: InjectionKey<AdminSession> = Symbol('admin-session');

export function provideAdminSession(session: AdminSession): void {
  provide(adminSessionKey, session);
}

export function useAdminShellSession(): AdminSession {
  return inject(adminSessionKey, undefined) ?? useAdminSession();
}
