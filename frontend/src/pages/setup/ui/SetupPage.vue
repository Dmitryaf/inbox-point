<script setup lang="ts">
import { ref, watch } from 'vue';

import { readSetupStatus } from '@frontend/entities/setup/api/setup-api';
import type { SetupStatus } from '@frontend/entities/setup/model/types';
import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import LoginForm from '@frontend/features/management-auth/ui/LoginForm.vue';
import TelegramSetupCard from '@frontend/features/setup-telegram/ui/TelegramSetupCard.vue';
import VkSetupCard from '@frontend/features/setup-vk/ui/VkSetupCard.vue';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

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

async function loadStatus(): Promise<void> {
  try {
    status.value = await readSetupStatus();
  } catch (cause: unknown) {
    if (cause instanceof HttpError && cause.status === 401) {
      session.expireSession();
      return;
    }
    error.value = errorMessage(cause);
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
    <header class="setup-header">
      <div>
        <p class="eyebrow">Messenger Handoff</p>
        <h1>Настройка сервиса</h1>
        <p class="page-intro">Подключите Telegram и VK.</p>
      </div>
      <button
        v-if="session.authenticated.value"
        class="secondary-button"
        type="button"
        @click="session.endSession"
      >
        Выйти
      </button>
    </header>

    <p v-if="session.booting.value" class="state-card" role="status">
      Проверяем доступ…
    </p>
    <template v-else>
      <section v-if="!session.authenticated.value" class="auth-panel">
        <div class="auth-stack">
          <AsyncMessage kind="error" :text="session.error.value" />
          <LoginForm
            :pending="session.pending.value"
            @submit="session.authenticate"
          />
        </div>
      </section>
      <template v-else>
        <AsyncMessage kind="error" :text="session.error.value || error" />
        <p v-if="!status" class="state-card" role="status">
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
    </template>
  </main>
</template>
