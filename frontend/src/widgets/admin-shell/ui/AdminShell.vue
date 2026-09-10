<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';

import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { provideAdminSession } from '@frontend/features/admin-auth/model/admin-session-context';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import AdminPageHeader, { type AdminSection } from './AdminPageHeader.vue';

const route = useRoute();
const router = useRouter();
const session = useAdminSession();
const dirty = ref(false);
const current = computed(
  () => (route.meta.adminSection as AdminSection | undefined) ?? 'answers',
);
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
</script>

<template>
  <div class="admin-shell">
    <div v-if="session.booting.value" class="admin-shell-state" role="status">
      Проверяем доступ…
    </div>
    <template v-else-if="session.authenticated.value">
      <AdminPageHeader
        :current="current"
        :intro="intro"
        :show-logout="session.mode.value === 'password'"
        :title="title"
        @logout="logOut"
      />
      <main class="admin-shell-content">
        <p
          v-if="session.error.value"
          class="message message--error"
          role="alert"
        >
          {{ session.error.value }}
        </p>
        <RouterView v-slot="{ Component }">
          <component :is="Component" @dirty-change="dirty = $event" />
        </RouterView>
      </main>
    </template>
  </div>
</template>

<style scoped src="../styles/admin-shell.css"></style>
