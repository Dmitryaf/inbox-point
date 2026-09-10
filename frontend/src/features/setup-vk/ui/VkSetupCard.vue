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
const messageKind = ref<'error' | 'info' | 'success'>('info');
const pending = ref(false);

async function connect(): Promise<void> {
  pending.value = true;
  messageKind.value = 'info';
  try {
    await connectVk(accessToken.value.trim(), community.value.trim());
    accessToken.value = '';
    message.value = 'VK подключён. Настройка сохранена.';
    messageKind.value = 'success';
    emit('connected');
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
    messageKind.value = 'error';
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section
    class="setup-card card"
    :class="{ 'setup-card--locked': !telegramConnected && !status.connected }"
    aria-labelledby="vk-setup-title"
  >
    <p class="step">Шаг 2</p>
    <h2 id="vk-setup-title">VK</h2>
    <p
      v-if="status.connected"
      class="setup-status setup-status--success setup-connected-status"
      role="status"
    >
      <strong>VK подключён</strong>
      <span>Новые сообщения сообщества будут передаваться операторам.</span>
    </p>
    <template v-else-if="!telegramConnected">
      <p class="setup-status setup-status--info">
        Сначала подключите Telegram. После этого здесь откроется следующий шаг.
      </p>
    </template>
    <template v-else>
      <VkSetupInstructions />
      <p v-if="status.locked" class="setup-status setup-status--info">
        VK подключён при установке. Если он не работает, откройте раздел
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
        <p
          class="setup-status"
          :class="`setup-status--${messageKind}`"
          :role="messageKind === 'error' ? 'alert' : 'status'"
        >
          {{ message }}
        </p>
      </form>
    </template>
  </section>
</template>

<style scoped src="../../../entities/setup/styles/setup-card.css"></style>
