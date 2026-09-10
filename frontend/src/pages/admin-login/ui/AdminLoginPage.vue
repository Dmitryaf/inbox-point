<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  leaveAdminLogin,
  takeAdminLoginMessage,
} from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

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
</script>

<template>
  <main class="login-page">
    <p class="eyebrow">Messenger Handoff</p>
    <section class="login-panel" aria-label="Вход в управление">
      <div class="login-stack">
        <AsyncMessage
          kind="error"
          :text="session.error.value || loginMessage"
        />
        <p v-if="session.booting.value" class="login-state card" role="status">
          Проверяем доступ…
        </p>
        <AdminLoginForm
          v-else
          :pending="session.pending.value"
          @submit="authenticate"
        />
      </div>
    </section>
  </main>
</template>

<style scoped src="../styles/admin-login-page.css"></style>
