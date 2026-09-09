<script setup lang="ts">
import { ref, watch } from 'vue';

import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';
import ContentWorkspace from '@frontend/widgets/content-workspace/ui/ContentWorkspace.vue';

const session = useAdminSession();
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
</script>

<template>
  <div class="shell">
    <AdminPageHeader
      :authenticated="session.authenticated.value"
      current="information"
      intro="Настройте готовые ответы для Telegram и VK."
      title="Информация"
      @logout="logOut"
    />

    <p v-if="session.booting.value" class="state-card" role="status">
      Открываем редактор…
    </p>
    <main v-else>
      <section v-if="!session.authenticated.value" class="auth-panel">
        <div class="auth-stack">
          <AsyncMessage kind="error" :text="session.error.value" />
          <AdminLoginForm
            :pending="session.pending.value"
            @submit="session.authenticate"
          />
        </div>
      </section>
      <template v-if="session.authenticated.value">
        <AsyncMessage kind="error" :text="session.error.value" />
      </template>
      <div v-if="workspaceActivated" v-show="session.authenticated.value">
        <ContentWorkspace
          :authenticated="session.authenticated.value"
          @dirty-change="hasUnsavedChanges = $event"
          @unauthorized="session.expireSession"
        />
      </div>
    </main>
  </div>
</template>
