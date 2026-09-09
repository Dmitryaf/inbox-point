<script setup lang="ts">
import type { InboundEventOperationsStatus } from '@frontend/entities/operations/model/types';

defineProps<{
  inboundEvents: InboundEventOperationsStatus;
  pendingEventId: string | undefined;
}>();
defineEmits<{
  resolve: [eventId: string, source: string, resolution: 'retry' | 'skip'];
}>();

function formatReceivedAt(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
</script>

<template>
  <article class="status-card delivery-card">
    <div class="status-card-heading">
      <h3>Входящие события</h3>
      <span
        class="status-pill"
        :class="
          inboundEvents.state === 'healthy'
            ? 'status-pill--healthy'
            : 'status-pill--attention'
        "
      >
        {{
          inboundEvents.state === 'healthy'
            ? 'Работает'
            : 'Есть изолированные события'
        }}
      </span>
    </div>
    <p v-if="inboundEvents.state === 'healthy'">
      Необрабатываемых событий VK нет.
    </p>
    <section
      v-else
      class="delivery-incidents"
      aria-labelledby="inbound-event-incidents-title"
    >
      <h4 id="inbound-event-incidents-title">Quarantine VK</h4>
      <ol>
        <li v-for="incident in inboundEvents.incidents" :key="incident.eventId">
          <div class="delivery-incident-heading">
            <strong>{{ incident.channel }}</strong>
            <time :datetime="incident.receivedAt">
              {{ formatReceivedAt(incident.receivedAt) }}
            </time>
          </div>
          <p>Событие не обработано после {{ incident.attempts }} попыток.</p>
          <details class="technical-details">
            <summary>Технические данные</summary>
            <dl class="delivery-incident-context">
              <div>
                <dt>ID события</dt>
                <dd>{{ incident.eventId }}</dd>
              </div>
              <div>
                <dt>Причина</dt>
                <dd>{{ incident.reason }}</dd>
              </div>
            </dl>
          </details>
          <div class="delivery-resolution-actions">
            <button
              class="secondary-button"
              type="button"
              :disabled="Boolean(pendingEventId)"
              @click="
                $emit('resolve', incident.eventId, incident.source, 'retry')
              "
            >
              {{
                pendingEventId === incident.eventId ? 'Сохраняем…' : 'Повторить'
              }}
            </button>
            <button
              type="button"
              :disabled="Boolean(pendingEventId)"
              @click="
                $emit('resolve', incident.eventId, incident.source, 'skip')
              "
            >
              {{
                pendingEventId === incident.eventId
                  ? 'Сохраняем…'
                  : 'Пропустить'
              }}
            </button>
          </div>
        </li>
      </ol>
    </section>
  </article>
</template>
