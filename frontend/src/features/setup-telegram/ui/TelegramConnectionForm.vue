<script setup lang="ts">
import { ref } from 'vue';

import {
  connectTelegram,
  discoverTelegramChats,
} from '@frontend/entities/setup/api/setup-api';
import type { TelegramOperatorChat } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';
import TelegramSetupInstructions from './TelegramSetupInstructions.vue';

defineProps<{ locked: boolean }>();
const emit = defineEmits<{ connected: [] }>();
const botToken = ref('');
const chats = ref<TelegramOperatorChat[]>([]);
const selectedChatId = ref<number | null>(null);
const message = ref('Выполните шаги ниже и найдите операторскую группу.');
const messageKind = ref<'error' | 'info' | 'success'>('info');
const pending = ref<'connect' | 'discover' | null>(null);

function chatLabel(chat: TelegramOperatorChat): string {
  return chat.isForum ? chat.title : `${chat.title} — включите темы`;
}

async function discover(): Promise<void> {
  pending.value = 'discover';
  messageKind.value = 'info';
  try {
    const result = await discoverTelegramChats(botToken.value.trim());
    chats.value = result.chats;
    selectedChatId.value = null;
    message.value = result.chats.length
      ? 'Выберите операторскую группу.'
      : 'Группа не найдена. Проверьте, что бот добавлен администратором, темы включены и после добавления бота в группе отправлено сообщение.';
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
    messageKind.value = 'error';
  } finally {
    pending.value = null;
  }
}

async function connect(): Promise<void> {
  if (selectedChatId.value === null) {
    message.value = 'Выберите операторскую группу.';
    messageKind.value = 'error';
    return;
  }
  pending.value = 'connect';
  messageKind.value = 'info';
  try {
    await connectTelegram(botToken.value.trim(), selectedChatId.value);
    botToken.value = '';
    chats.value = [];
    message.value = 'Telegram подключён. Настройка сохранена.';
    messageKind.value = 'success';
    emit('connected');
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
    messageKind.value = 'error';
  } finally {
    pending.value = null;
  }
}
</script>

<template>
  <TelegramSetupInstructions />
  <p v-if="locked" class="setup-status setup-status--info">
    Telegram подключён при установке. Если он не работает, откройте раздел
    «Мониторинг».
  </p>
  <template v-else>
    <label for="telegram-token">Токен бота — строка-пароль от @BotFather</label>
    <input
      id="telegram-token"
      v-model="botToken"
      autocomplete="off"
      type="password"
    />
    <button
      :disabled="pending !== null || botToken.trim().length < 20"
      type="button"
      @click="discover"
    >
      {{
        pending === 'discover' ? 'Проверяем…' : 'Проверить токен и найти группу'
      }}
    </button>
    <fieldset v-if="chats.length" class="setup-options">
      <legend>Операторская группа</legend>
      <label v-for="chat in chats" :key="chat.id">
        <input v-model="selectedChatId" :value="chat.id" type="radio" />
        <span>{{ chatLabel(chat) }}</span>
      </label>
    </fieldset>
    <button
      v-if="chats.length"
      :disabled="pending !== null || selectedChatId === null"
      type="button"
      @click="connect"
    >
      {{ pending === 'connect' ? 'Подключаем…' : 'Подключить Telegram' }}
    </button>
    <p
      class="setup-status"
      :class="`setup-status--${messageKind}`"
      :role="messageKind === 'error' ? 'alert' : 'status'"
    >
      {{ message }}
    </p>
  </template>
</template>

<style scoped src="../../../entities/setup/styles/setup-card.css"></style>
