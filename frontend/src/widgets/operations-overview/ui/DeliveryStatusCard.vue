<script setup lang="ts">
import { computed } from 'vue';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';

const props = defineProps<{
  deliveries: OperationsStatus['deliveries'];
}>();

const state = computed(() => {
  if (props.deliveries.state === 'paused') {
    return { label: 'Отправка приостановлена', tone: 'neutral' };
  }
  if (props.deliveries.state === 'failed') {
    return { label: 'Есть ошибки', tone: 'attention' };
  }
  if (props.deliveries.state === 'stalled') {
    return { label: 'Отправка приостановлена', tone: 'attention' };
  }
  if (props.deliveries.state === 'backlog') {
    return { label: 'Ответы задерживаются', tone: 'attention' };
  }
  return { label: 'Работает', tone: 'healthy' };
});
</script>

<template>
  <article class="status-card delivery-card">
    <div class="status-card-heading">
      <h3>Отправка ответов</h3>
      <span class="status-pill" :class="`status-pill--${state.tone}`">
        {{ state.label }}
      </span>
    </div>
    <dl class="delivery-facts">
      <div>
        <dt>Ожидают отправки</dt>
        <dd>{{ deliveries.pending }}</dd>
      </div>
      <div>
        <dt>Не доставлены</dt>
        <dd>{{ deliveries.failed }}</dd>
      </div>
      <div v-if="deliveries.uncertain > 0">
        <dt>Требуют ручной проверки</dt>
        <dd>{{ deliveries.uncertain }}</dd>
      </div>
      <div v-if="deliveries.oldestPendingAgeSeconds !== undefined">
        <dt>Самое старое ожидание</dt>
        <dd>{{ formatUptime(deliveries.oldestPendingAgeSeconds) }}</dd>
      </div>
    </dl>
    <details class="technical-details status-technical-details">
      <summary>Технические данные</summary>
      <dl class="delivery-facts">
        <div>
          <dt>Система отправки</dt>
          <dd>{{ deliveries.worker.running ? 'Запущена' : 'Остановлена' }}</dd>
        </div>
      </dl>
    </details>
  </article>
</template>

<style scoped src="../styles/status-card.css"></style>
<style scoped src="../styles/delivery-status-card.css"></style>
