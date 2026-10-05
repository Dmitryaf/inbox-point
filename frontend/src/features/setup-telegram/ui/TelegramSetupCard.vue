<script setup lang="ts">
import { ref } from 'vue';

import { disconnectTelegram } from '@frontend/entities/setup/api/setup-api';
import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';
import TelegramConnectionForm from './TelegramConnectionForm.vue';

const props = defineProps<{
  status: ChannelSetupStatus;
  vkConfigured: boolean;
}>();
const emit = defineEmits<{ connected: []; disconnected: [] }>();
const expanded = ref(false);
const disconnectError = ref('');
const disconnecting = ref(false);

async function disconnect(): Promise<void> {
  if (
    props.vkConfigured ||
    !window.confirm(
      'Отключить Telegram? Приложение перестанет получать сообщения из бота и передавать обращения в группу администраторов. История обращений сохранится.',
    )
  ) {
    return;
  }
  disconnecting.value = true;
  disconnectError.value = '';
  try {
    await disconnectTelegram();
    emit('disconnected');
  } catch (cause: unknown) {
    disconnectError.value = errorMessage(cause);
  } finally {
    disconnecting.value = false;
  }
}
</script>

<template>
  <section
    class="setup-card card"
    :class="{ 'setup-card--expanded': expanded }"
    aria-labelledby="telegram-setup-title"
  >
    <header class="setup-card-heading">
      <div>
        <h2 id="telegram-setup-title">Telegram</h2>
        <p>Бот для клиентов и группа, где сотрудники отвечают на вопросы.</p>
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
      type="button"
      :aria-expanded="expanded"
      aria-controls="telegram-setup-details"
      @click="expanded = !expanded"
    >
      {{
        expanded
          ? 'Скрыть'
          : status.source !== 'none'
            ? 'Сведения'
            : 'Подключить Telegram'
      }}
    </button>
    <div v-show="expanded" id="telegram-setup-details" class="setup-details">
      <template v-if="expanded">
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
            <p v-if="vkConfigured" class="setup-status setup-status--info">
              Чтобы отключить Telegram, сначала отключите VK.
            </p>
            <button
              class="danger"
              type="button"
              :disabled="disconnecting || vkConfigured"
              @click="disconnect"
            >
              {{ disconnecting ? 'Отключаем…' : 'Отключить Telegram' }}
            </button>
            <p
              v-if="disconnectError"
              class="setup-status setup-status--error"
              role="alert"
            >
              {{ disconnectError }}
            </p>
          </template>
        </template>
        <TelegramConnectionForm
          v-else
          :locked="status.locked"
          @connected="$emit('connected')"
        />
      </template>
    </div>
  </section>
</template>

<style scoped src="../../../entities/setup/styles/setup-card.css"></style>
