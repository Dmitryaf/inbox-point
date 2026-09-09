<script setup lang="ts">
import { ref } from 'vue';

import { connectVk } from '@frontend/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';
import VkSetupInstructions from './VkSetupInstructions.vue';

const props = defineProps<{
  status: ChannelSetupStatus;
  telegramConnected: boolean;
}>();
const emit = defineEmits<{ connected: [] }>();
const community = ref('');
const accessToken = ref('');
const message = ref('Выполните шаги и подключите сообщество.');
const pending = ref(false);

async function connect(): Promise<void> {
  pending.value = true;
  try {
    await connectVk(accessToken.value.trim(), community.value.trim());
    accessToken.value = '';
    message.value = 'VK подключён. Настройка сохранена.';
    emit('connected');
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="setup-card card" aria-labelledby="vk-setup-title">
    <p class="step">Шаг 2</p>
    <h2 id="vk-setup-title">VK</h2>
    <p v-if="status.connected" class="setup-status setup-status--success">
      VK подключён. После перезапуска сервис восстановит подключение
      автоматически.
    </p>
    <template v-else>
      <VkSetupInstructions />
      <p v-if="!telegramConnected" class="setup-status">
        Сначала подключите Telegram для операторов.
      </p>
      <p v-else-if="status.locked" class="setup-status">
        VK настроен на сервере. Если он не работает, откройте раздел
        «Состояние».
      </p>
      <form v-else class="setup-form" @submit.prevent="connect">
        <label for="vk-community">Адрес сообщества VK</label>
        <input
          id="vk-community"
          v-model="community"
          placeholder="https://vk.com/your_community"
          required
          type="text"
        />
        <label for="vk-token">Ключ доступа с правом работы с сообщениями</label>
        <input
          id="vk-token"
          v-model="accessToken"
          autocomplete="off"
          required
          type="password"
        />
        <button
          :disabled="pending || accessToken.trim().length < 20"
          type="submit"
        >
          {{ pending ? 'Подключаем…' : 'Подключить VK' }}
        </button>
        <p class="setup-status" role="status">{{ message }}</p>
      </form>
    </template>
  </section>
</template>
