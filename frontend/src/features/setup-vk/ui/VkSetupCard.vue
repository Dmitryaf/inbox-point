<script setup lang="ts">
import { computed, ref } from 'vue';

import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { useVkSetup } from '@frontend/features/setup-vk/model/use-vk-setup';
import VkSetupInstructions from './VkSetupInstructions.vue';

const props = defineProps<{
  status: ChannelSetupStatus;
  telegramConnected: boolean;
}>();
const emit = defineEmits<{ connected: []; disconnected: [] }>();
const expanded = ref(false);
const {
  accessToken,
  community,
  connect,
  disconnect,
  disconnecting,
  message,
  messageKind,
  pending,
} = useVkSetup(
  () => emit('connected'),
  () => emit('disconnected'),
);
const toggleLabel = computed(() => {
  if (!props.telegramConnected && !props.status.connected) {
    return 'Сначала Telegram';
  }
  if (expanded.value) {
    return 'Скрыть';
  }
  return props.status.source !== 'none' ? 'Сведения' : 'Подключить VK';
});
</script>

<template>
  <section
    class="setup-card card"
    :class="{
      'setup-card--expanded': expanded,
      'setup-card--locked': !telegramConnected && !status.connected,
    }"
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
        Подключение активно.
      </p>
      <template v-if="status.source !== 'none'">
        <p
          v-if="status.source === 'environment'"
          class="setup-status setup-status--info"
        >
          Управляется на сервере.
        </p>
        <template v-else>
          <button
            class="danger"
            type="button"
            :disabled="disconnecting"
            @click="disconnect"
          >
            {{ disconnecting ? 'Отключаем…' : 'Отключить VK' }}
          </button>
          <p
            v-if="messageKind === 'error'"
            class="setup-status setup-status--error"
            role="alert"
          >
            {{ message }}
          </p>
        </template>
      </template>
      <template v-else>
        <VkSetupInstructions />
        <p v-if="status.locked" class="setup-status setup-status--info">
          VK подключён при установке. Если он не работает, откройте раздел
          «Мониторинг».
        </p>
        <form v-else class="setup-form" @submit.prevent="connect">
          <label for="vk-community">Ссылка на страницу сообщества VK</label>
          <input
            id="vk-community"
            v-model="community"
            placeholder="https://vk.com/your_community"
            required
            type="text"
          />
          <label for="vk-token">Ключ с правами управления и сообщений</label>
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
