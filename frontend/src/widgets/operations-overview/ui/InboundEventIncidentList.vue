<script setup lang="ts">
import type { InboundEventIncident } from '@frontend/entities/operations/model/types';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

defineProps<{
  incidents: readonly InboundEventIncident[];
  pendingEventId: string | undefined;
}>();
defineEmits<{
  resolve: [eventId: string, source: string, resolution: 'retry' | 'skip'];
}>();
</script>

<template>
  <section
    v-if="incidents.length > 0"
    class="delivery-incidents"
    aria-labelledby="inbound-event-incidents-title"
  >
    <h3 id="inbound-event-incidents-title">Необработанные сообщения VK</h3>
    <p>
      Некоторые события VK не удалось обработать автоматически. Сначала
      попробуйте обработать их ещё раз.
    </p>
    <ol>
      <li v-for="incident in incidents" :key="incident.eventId">
        <div class="delivery-incident-heading">
          <strong>Сообщение VK требует решения</strong>
          <time :datetime="incident.receivedAt">
            {{ formatShortDateTime(incident.receivedAt) }}
          </time>
        </div>
        <p>
          После повторной обработки сообщение может появиться у оператора. Если
          событие точно не нужно, его можно пропустить.
        </p>
        <details class="technical-details">
          <summary>Технические данные</summary>
          <dl class="delivery-incident-context">
            <div>
              <dt>ID события</dt>
              <dd>{{ incident.eventId }}</dd>
            </div>
            <div>
              <dt>Попыток обработки</dt>
              <dd>{{ incident.attempts }}</dd>
            </div>
            <div>
              <dt>Источник</dt>
              <dd>{{ incident.source }}</dd>
            </div>
            <div>
              <dt>Причина</dt>
              <dd>{{ incident.reason }}</dd>
            </div>
          </dl>
        </details>
        <div class="delivery-resolution-actions">
          <button
            type="button"
            :disabled="Boolean(pendingEventId)"
            @click="
              $emit('resolve', incident.eventId, incident.source, 'retry')
            "
          >
            {{
              pendingEventId === incident.eventId
                ? 'Повторяем…'
                : 'Повторить обработку'
            }}
          </button>
          <button
            class="quiet-danger"
            type="button"
            :disabled="Boolean(pendingEventId)"
            @click="$emit('resolve', incident.eventId, incident.source, 'skip')"
          >
            {{
              pendingEventId === incident.eventId
                ? 'Сохраняем…'
                : 'Пропустить событие'
            }}
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped src="../styles/incident-list.css"></style>
