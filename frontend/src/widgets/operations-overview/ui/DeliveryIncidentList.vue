<script setup lang="ts">
import type { DeliveryIncident } from '@frontend/entities/operations/model/types';

defineProps<{
  incidents: readonly DeliveryIncident[];
  pendingDeliveryId: string | undefined;
}>();
defineEmits<{
  resolve: [deliveryId: string, resolution: 'not_received' | 'received'];
  retry: [deliveryId: string];
}>();

function formatCreatedAt(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <section
    v-if="incidents.length > 0"
    class="delivery-incidents"
    aria-labelledby="delivery-incidents-title"
  >
    <h4 id="delivery-incidents-title">Недоставленные ответы</h4>
    <ol>
      <li v-for="incident in incidents" :key="incident.id">
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
        <div v-else class="delivery-resolution-actions">
          <p>Сначала уточните у клиента, был ли получен ответ.</p>
          <button
            class="secondary-button"
            type="button"
            :disabled="Boolean(pendingDeliveryId)"
            @click="$emit('resolve', incident.id, 'received')"
          >
            {{
              pendingDeliveryId === incident.id
                ? 'Сохраняем…'
                : 'Клиент получил'
            }}
          </button>
          <button
            type="button"
            :disabled="Boolean(pendingDeliveryId)"
            @click="$emit('resolve', incident.id, 'not_received')"
          >
            {{
              pendingDeliveryId === incident.id
                ? 'Сохраняем…'
                : 'Клиент не получил — повторить'
            }}
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>
