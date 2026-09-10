<script setup lang="ts">
import { computed, ref } from 'vue';

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
const expanded = ref(false);
const toggleLabel = computed(() => {
  if (!props.telegramConnected && !props.status.connected) {
    return 'Сначала Telegram';
  }
  if (expanded.value) {
    return 'Скрыть';
  }
  return props.status.connected ? 'Сведения' : 'Подключить VK';
});

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
    <header class="setup-card-heading">
      <div>
        <h2 id="vk-setup-title">VK</h2>
        <p>Сообщество, из которого приходят сообщения клиентов.</p>
      </div>
      <span
        class="status-pill"
        :class="
          status.connected ? 'status-pill--healthy' : 'status-pill--neutral'
        "
      >
        {{ status.connected ? 'Подключён' : 'Не подключён' }}
      </span>
    </header>
    <button
      class="quiet setup-toggle"
      :disabled="!telegramConnected && !status.connected"
      type="button"
      @click="expanded = !expanded"
    >
      {{ toggleLabel }}
    </button>
    <div v-if="expanded" class="setup-details">
      <p
        v-if="status.connected"
        class="setup-status setup-status--success"
        role="status"
      >
        Подключение активно. Изменить секреты можно через конфигурацию
        установки.
      </p>
      <template v-else>
        <VkSetupInstructions />
        <p v-if="status.locked" class="setup-status setup-status--info">
          VK подключён при установке. Если он не работает, откройте раздел
          «Мониторинг».
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
          <label for="vk-token">Ключ доступа VK</label>
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
    </div>
  </section>
</template>

<style scoped src="../../../entities/setup/styles/setup-card.css"></style>
