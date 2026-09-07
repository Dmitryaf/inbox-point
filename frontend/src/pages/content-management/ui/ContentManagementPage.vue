<script setup lang="ts">
import { ref, watch } from 'vue';

import { useManagementSession } from '@frontend/features/management-auth/model/use-management-session';
import LoginForm from '@frontend/features/management-auth/ui/LoginForm.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import ContentWorkspace from '@frontend/widgets/content-workspace/ui/ContentWorkspace.vue';

const session = useManagementSession();
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
    <header class="hero">
      <div>
        <p class="eyebrow">Messenger Handoff</p>
        <h1>Информация для клиентов</h1>
        <p>Обновите ответы, которые клиенты видят в Telegram и VK.</p>
      </div>
      <button
        v-if="session.authenticated.value"
        class="secondary-button"
        type="button"
        @click="logOut"
      >
        Выйти
      </button>
    </header>

    <p v-if="session.booting.value" class="state-card" role="status">
      Открываем редактор…
    </p>
    <main v-else>
      <section v-if="!session.authenticated.value" class="auth-panel">
        <div class="auth-stack">
          <AsyncMessage kind="error" :text="session.error.value" />
          <LoginForm
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
