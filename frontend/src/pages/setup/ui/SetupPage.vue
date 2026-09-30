<script setup lang="ts">
import { ref, watch } from 'vue';

import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard.vue';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard.vue';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const session = useAdminShellSession();
const status = ref<SetupStatus>();
const error = ref('');
const loading = ref(false);
let loadVersion = 0;

watch(
  session.authenticated,
  (authenticated) => {
    status.value = undefined;
    error.value = '';
    loadVersion += 1;
    loading.value = false;
    if (authenticated) {
      void loadStatus();
    }
  },
  { immediate: true },
);

async function loadStatus(): Promise<void> {
  const version = ++loadVersion;
  loading.value = true;
  error.value = '';
  try {
    const result = await readSetupStatus();
    if (version === loadVersion) {
      status.value = result;
    }
  } catch (cause: unknown) {
    if (version === loadVersion) {
      error.value = requestErrorMessage(cause, session.expireSession);
    }
  } finally {
    if (version === loadVersion) {
      loading.value = false;
    }
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

function markTelegramDisconnected(): void {
  if (status.value) {
    status.value.connected = false;
    status.value.locked = false;
    status.value.source = 'none';
  }
}

function markVkDisconnected(): void {
  if (status.value) {
    status.value.vk.connected = false;
    status.value.vk.locked = false;
    status.value.vk.source = 'none';
  }
}
</script>

<template>
  <section class="setup-page">
    <template v-if="session.authenticated.value">
      <AsyncMessage kind="error" :text="session.error.value || error" />
      <p v-if="loading" class="state-card card" role="status">
        Проверяем подключения…
      </p>
      <button
        v-else-if="error"
        type="button"
        class="secondary-button"
        @click="loadStatus"
      >
        Повторить проверку подключений
      </button>
      <div v-else-if="status" class="setup-workspace">
        <div
          class="setup-channel-grid"
          :class="{
            'setup-channel-grid--mixed':
              status.connected !== status.vk.connected,
          }"
        >
          <TelegramSetupCard
            :status="status"
            :vk-configured="status.vk.source !== 'none'"
            @connected="markTelegramConnected"
            @disconnected="markTelegramDisconnected"
          />
          <VkSetupCard
            :status="status.vk"
            :telegram-connected="status.connected"
            @connected="markVkConnected"
            @disconnected="markVkDisconnected"
          />
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped src="../styles/setup-page.css"></style>
