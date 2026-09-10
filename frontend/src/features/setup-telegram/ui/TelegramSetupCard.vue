<script setup lang="ts">
import { ref } from 'vue';

import type { ChannelSetupStatus } from '@frontend/entities/setup/model/types';
import TelegramConnectionForm from './TelegramConnectionForm.vue';

defineProps<{ status: ChannelSetupStatus }>();
defineEmits<{ connected: [] }>();
const expanded = ref(false);
</script>

<template>
  <section class="setup-card card" aria-labelledby="telegram-setup-title">
    <header class="setup-card-heading">
      <div>
        <h2 id="telegram-setup-title">Telegram</h2>
        <p>Операторская группа и бот для передачи обращений.</p>
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
      @click="expanded = !expanded"
    >
      {{
        expanded
          ? 'Скрыть'
          : status.connected
            ? 'Сведения'
            : 'Подключить Telegram'
      }}
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
      <TelegramConnectionForm
        v-else
        :locked="status.locked"
        @connected="$emit('connected')"
      />
    </div>
  </section>
</template>

<style scoped src="../../../entities/setup/styles/setup-card.css"></style>
