import { type ComponentAttributes } from '@frontend/shared/lib/component-model';

import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from '@frontend/shared/lib/model-state';
import { useRoute, useRouter } from '@frontend/shared/lib/router';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { provideAdminSession } from '@frontend/features/admin-auth/model/admin-session-context';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';

export type ComponentProps = ComponentAttributes;
export const componentDefaults = {};

export function createComponentModel() {
  const route = useRoute();
  const router = useRouter();
  const session = useAdminSession();
  const dirty = ref(false);
  const current = computed(() => route.meta.adminSection ?? 'answers');
  const title = computed(() => String(route.meta.pageTitle ?? 'Управление'));
  const intro = computed(() => String(route.meta.description ?? ''));
  provideAdminSession(session);
  watch(
    [session.booting, session.authenticated],
    ([booting, authenticated]) => {
      if (!booting && !authenticated) {
        dirty.value = false;
        openAdminLogin(router, route.path, session.error.value || undefined);
      }
    },
    { immediate: true },
  );
  const removeNavigationGuard = router.beforeEach((to, from) => {
    if (
      dirty.value &&
      from.name === 'manage' &&
      to.name !== 'manage' &&
      !window.confirm('Уйти без сохранения изменений?')
    ) {
      return false;
    }
    if (from.name === 'manage' && to.name !== 'manage') {
      dirty.value = false;
    }
    return true;
  });
  onBeforeUnmount(removeNavigationGuard);
  async function logOut(): Promise<void> {
    if (dirty.value && !window.confirm('Выйти без сохранения изменений?')) {
      return;
    }
    dirty.value = false;
    await session.endSession();
  }
  return { session, dirty, current, title, intro, logOut };
}
