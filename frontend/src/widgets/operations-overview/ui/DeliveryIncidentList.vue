<script setup lang="ts">
import type { DeliveryIncident } from '@frontend/entities/operations/model/types';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

defineProps<{
  incidents: readonly DeliveryIncident[];
  pendingDeliveryId: string | undefined;
}>();
defineEmits<{
  resolve: [deliveryId: string, resolution: 'not_received' | 'received'];
  retry: [deliveryId: string];
}>();
</script>

<template>
  <section
    v-if="incidents.length > 0"
    class="delivery-incidents"
    aria-labelledby="delivery-incidents-title"
  >
    <h3 id="delivery-incidents-title">Ответы клиентам</h3>
    <p>Эти ответы не дошли или требуют ручной проверки.</p>
    <ol>
      <li v-for="incident in incidents" :key="incident.id">
        <div class="delivery-incident-heading">
          <strong>
            {{
              incident.retryAllowed
                ? `Ответ в ${incident.channel} не доставлен`
                : `Доставку в ${incident.channel} нужно проверить`
            }}
          </strong>
          <time :datetime="incident.createdAt">
            {{ formatShortDateTime(incident.createdAt) }}
          </time>
        </div>
        <p v-if="incident.retryAllowed">
          Ответ не дошёл до клиента. Попробуйте отправить его ещё раз.
        </p>
        <p v-else>
          Не удалось узнать, получил ли клиент ответ. Сначала проверьте
          переписку, затем выберите подходящее действие.
        </p>
        <details class="technical-details">
          <summary>Технические данные</summary>
          <dl class="delivery-incident-context">
            <div>
              <dt>ID обращения</dt>
              <dd>{{ incident.requestId }}</dd>
            </div>
            <div>
              <dt>ID темы в Telegram</dt>
              <dd>{{ incident.operatorTopicId }}</dd>
            </div>
            <div v-if="incident.operatorMessageId">
              <dt>ID сообщения</dt>
              <dd>{{ incident.operatorMessageId }}</dd>
            </div>
            <div>
              <dt>Причина</dt>
              <dd>{{ incident.reason }}</dd>
            </div>
          </dl>
        </details>
        <button
          v-if="incident.retryAllowed"
          type="button"
          :disabled="Boolean(pendingDeliveryId)"
          @click="$emit('retry', incident.id)"
        >
          {{
            pendingDeliveryId === incident.id
              ? 'Начинаем отправку…'
              : 'Повторить отправку'
          }}
        </button>
        <div v-else class="delivery-resolution-actions">
          <p>Сначала проверьте, было ли получено сообщение.</p>
          <button
            class="secondary-button"
            type="button"
            :disabled="Boolean(pendingDeliveryId)"
            @click="$emit('resolve', incident.id, 'received')"
          >
            {{
              pendingDeliveryId === incident.id
                ? 'Сохраняем…'
                : 'Сообщение получено'
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
                : 'Не получено — повторить'
            }}
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped src="../styles/incident-list.css"></style>
