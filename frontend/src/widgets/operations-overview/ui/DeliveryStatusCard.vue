<script setup lang="ts">
import { computed } from 'vue';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import OutboundDeliveryControl from './OutboundDeliveryControl.vue';

const props = defineProps<{
  deliveries: OperationsStatus['deliveries'];
  deliveryControlPending: 'pause' | 'resume' | undefined;
  outbound: OperationsStatus['outbound'];
  pendingDeliveryId: string | undefined;
}>();
defineEmits<{
  changeDeliveryMode: [mode: 'pause' | 'resume'];
  retry: [deliveryId: string];
}>();

const state = computed(() => {
  if (props.deliveries.state === 'paused') {
    return { label: 'Доставка остановлена', tone: 'neutral' };
  }
  if (props.deliveries.state === 'failed') {
    return { label: 'Есть ошибки', tone: 'attention' };
  }
  if (props.deliveries.state === 'stalled') {
    return { label: 'Обработчик остановлен', tone: 'attention' };
  }
  if (props.deliveries.state === 'backlog') {
    return { label: 'Очередь задерживается', tone: 'attention' };
  }
  return { label: 'Работает', tone: 'healthy' };
});

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <article class="status-card delivery-card">
    <div class="status-card-heading">
      <h3>Доставка ответов</h3>
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
      <div>
        <dt>Обработчик очереди</dt>
        <dd>{{ deliveries.worker.running ? 'Запущен' : 'Остановлен' }}</dd>
      </div>
      <div v-if="deliveries.oldestPendingAgeSeconds !== undefined">
        <dt>Самое старое ожидание</dt>
        <dd>{{ formatUptime(deliveries.oldestPendingAgeSeconds) }}</dd>
      </div>
    </dl>
    <OutboundDeliveryControl
      :outbound="outbound"
      :pending="deliveryControlPending"
      @change="$emit('changeDeliveryMode', $event)"
    />
    <section
      v-if="deliveries.incidents.length > 0"
      class="delivery-incidents"
      aria-labelledby="delivery-incidents-title"
    >
      <h4 id="delivery-incidents-title">Недоставленные ответы</h4>
      <ol>
        <li v-for="incident in deliveries.incidents" :key="incident.id">
          <div class="delivery-incident-heading">
            <strong>{{ incident.channel }}</strong>
            <time :datetime="incident.createdAt">
              {{ formatCreatedAt(incident.createdAt) }}
            </time>
          </div>
          <p>{{ incident.reason }}</p>
          <dl class="delivery-incident-context">
            <div>
              <dt>Обращение</dt>
              <dd>{{ incident.requestId }}</dd>
            </div>
            <div>
              <dt>Тема преподавателя</dt>
              <dd>{{ incident.operatorTopicId }}</dd>
            </div>
            <div v-if="incident.operatorMessageId">
              <dt>Сообщение преподавателя</dt>
              <dd>{{ incident.operatorMessageId }}</dd>
            </div>
          </dl>
          <button
            v-if="incident.retryAllowed"
            class="secondary-button"
            type="button"
            :disabled="Boolean(pendingDeliveryId)"
            @click="$emit('retry', incident.id)"
          >
            {{
              pendingDeliveryId === incident.id
                ? 'Ставим в очередь…'
                : 'Повторить доставку'
            }}
          </button>
          <p v-else class="delivery-incident-note">
            Уточните получение через тему обращения. Повтор без проверки может
            отправить клиенту дубликат.
          </p>
        </li>
      </ol>
    </section>
  </article>
</template>
