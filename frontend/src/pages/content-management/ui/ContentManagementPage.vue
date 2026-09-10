<script setup lang="ts">
import { ref, watch } from 'vue';

import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';
import ContentWorkspace from '@frontend/widgets/content-workspace/ui/ContentWorkspace.vue';

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
</script>

<template>
  <div class="shell">
    <AdminPageHeader
      v-if="session.authenticated.value"
      :authenticated="session.authenticated.value"
      current="information"
      intro="Настройте готовые ответы для Telegram и VK."
      title="Информация"
      @logout="logOut"
    />

    <p v-if="session.booting.value" class="state-card card" role="status">
      Открываем редактор…
    </p>
    <main v-else-if="session.authenticated.value">
      <AsyncMessage kind="error" :text="session.error.value" />
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

<style scoped src="../styles/content-management-page.css"></style>
