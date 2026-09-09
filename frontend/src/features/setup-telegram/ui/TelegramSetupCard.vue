<script setup lang="ts">
import { ref } from 'vue';

import {
  connectTelegram,
  discoverTelegramChats,
} from '@frontend/entities/setup/api/setup-api';
import type {
  ChannelSetupStatus,
  TelegramOperatorChat,
} from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';
import TelegramSetupInstructions from './TelegramSetupInstructions.vue';

const props = defineProps<{ status: ChannelSetupStatus }>();
const emit = defineEmits<{ connected: [] }>();
const botToken = ref('');
const chats = ref<TelegramOperatorChat[]>([]);
const selectedChatId = ref<number | null>(null);
const message = ref('Выполните шаги ниже и найдите операторскую группу.');
const pending = ref<'connect' | 'discover' | null>(null);

function chatLabel(chat: TelegramOperatorChat): string {
  if (chat.isForum) {
    return chat.title;
  }
  return `${chat.title} — включите темы`;
}

async function discover(): Promise<void> {
  pending.value = 'discover';
  try {
    const result = await discoverTelegramChats(botToken.value.trim());
    chats.value = result.chats;
    selectedChatId.value = null;
    message.value = result.chats.length
      ? 'Выберите операторскую группу.'
      : 'Напишите в группе сообщение и повторите поиск.';
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
  } finally {
    pending.value = null;
  }
}

async function connect(): Promise<void> {
  if (selectedChatId.value === null) {
    message.value = 'Выберите операторскую группу.';
    return;
  }
  pending.value = 'connect';
  try {
    await connectTelegram(botToken.value.trim(), selectedChatId.value);
    botToken.value = '';
    chats.value = [];
    message.value = 'Telegram подключён. Настройка сохранена.';
    emit('connected');
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
  } finally {
    pending.value = null;
  }
}
</script>

<template>
  <section class="setup-card card" aria-labelledby="telegram-setup-title">
    <p class="step">Шаг 1</p>
    <h2 id="telegram-setup-title">Telegram</h2>
    <p v-if="status.connected" class="setup-status setup-status--success">
      Telegram подключён. После перезапуска сервис восстановит подключение
      автоматически.
    </p>
    <template v-else>
      <TelegramSetupInstructions />
      <p v-if="status.locked" class="setup-status">
        Telegram настроен на сервере. Если он не работает, откройте раздел
        «Состояние».
      </p>
      <template v-else>
        <label for="telegram-token">Токен от @BotFather</label>
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
          {{ pending === 'discover' ? 'Ищем…' : 'Найти группы' }}
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
        <p class="setup-status" role="status">{{ message }}</p>
      </template>
    </template>
  </section>
</template>
