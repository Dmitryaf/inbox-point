<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  leaveAdminLogin,
  takeAdminLoginMessage,
} from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

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
</script>

<template>
  <main class="login-page">
    <div class="login-stack">
      <p class="login-brand">Inbox Point</p>
      <AsyncMessage kind="error" :text="session.error.value || loginMessage" />
      <p v-if="session.booting.value" class="login-state" role="status">
        Проверяем доступ…
      </p>
      <AdminLoginForm
        v-else
        :pending="session.pending.value"
        @submit="authenticate"
      />
    </div>
  </main>
</template>

<style scoped src="../styles/admin-login-page.css"></style>
