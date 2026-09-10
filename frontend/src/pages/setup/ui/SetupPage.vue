<script setup lang="ts">
import { ref, watch } from 'vue';

import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard.vue';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard.vue';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';
import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';

const session = useAdminSession();
const status = ref<SetupStatus>();
const error = ref('');

watch(session.authenticated, (authenticated) => {
  status.value = undefined;
  error.value = '';
  if (authenticated) {
    void loadStatus();
  }
});

watch(
  [session.booting, session.authenticated],
  ([booting, authenticated]) => {
    if (!booting && !authenticated) {
      openAdminLogin('/setup');
    }
  },
  { immediate: true },
);

async function logOut(): Promise<void> {
  await session.endSession();
}

async function loadStatus(): Promise<void> {
  try {
    status.value = await readSetupStatus();
  } catch (cause: unknown) {
    error.value = requestErrorMessage(cause, session.expireSession);
  }
}

function markTelegramConnected(): void {
  if (status.value) {
    status.value.connected = true;
    status.value.locked = true;
    status.value.source = 'local';
  }
}

function markVkConnected(): void {
  if (status.value) {
    status.value.vk.connected = true;
    status.value.vk.locked = true;
    status.value.vk.source = 'local';
  }
}
</script>

<template>
  <main class="setup-shell">
    <AdminPageHeader
      v-if="session.authenticated.value"
      :authenticated="session.authenticated.value"
      current="channels"
      intro="Сначала подключите Telegram для операторов, затем VK для сообщений клиентов."
      title="Каналы"
      @logout="logOut"
    />

    <p v-if="session.booting.value" class="state-card card" role="status">
      Проверяем доступ…
    </p>
    <template v-else-if="session.authenticated.value">
      <AsyncMessage kind="error" :text="session.error.value || error" />
      <p v-if="!status" class="state-card card" role="status">
        Проверяем подключения…
      </p>
      <div v-else class="setup-workspace">
        <div
          class="setup-channel-grid"
          :class="{
            'setup-channel-grid--mixed':
              status.connected !== status.vk.connected,
          }"
        >
          <TelegramSetupCard
            :status="status"
            @connected="markTelegramConnected"
          />
          <VkSetupCard
            :status="status.vk"
            :telegram-connected="status.connected"
            @connected="markVkConnected"
          />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped src="../styles/setup-page.css"></style>
