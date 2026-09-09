<script setup lang="ts">
import type { OperatorRelayIncident } from '@frontend/entities/operations/model/types';

defineProps<{
  incidents: readonly OperatorRelayIncident[];
  pendingActionId: string | undefined;
}>();
defineEmits<{
  resolve: [actionId: string, resolution: 'received' | 'use_web'];
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
    aria-labelledby="operator-relay-incidents-title"
  >
    <h4 id="operator-relay-incidents-title">
      Передача обращений требует проверки
    </h4>
    <ol>
      <li v-for="incident in incidents" :key="incident.id">
        <div class="delivery-incident-heading">
          <strong>{{ incident.channel }}</strong>
          <time :datetime="incident.createdAt">
            {{ formatCreatedAt(incident.createdAt) }}
          </time>
        </div>
        <p>{{ incident.reason }}</p>
        <details class="technical-details">
          <summary>Технические данные</summary>
          <dl class="delivery-incident-context">
            <div>
              <dt>ID обращения</dt>
              <dd>{{ incident.requestId }}</dd>
            </div>
            <div>
              <dt>ID сообщения клиента</dt>
              <dd>{{ incident.clientMessageId }}</dd>
            </div>
            <div v-if="incident.action === 'relay_message'">
              <dt>ID темы Telegram</dt>
              <dd>{{ incident.operatorTopicId }}</dd>
            </div>
            <div>
              <dt>Операция</dt>
              <dd>
                {{
                  incident.action === 'open_request'
                    ? 'Создание Telegram-темы'
                    : `Передача части ${incident.sequence + 1}`
                }}
              </dd>
            </div>
          </dl>
        </details>
        <div class="delivery-resolution-actions">
          <p v-if="incident.action === 'relay_message'">
            Проверьте Telegram-тему перед выбором действия.
          </p>
          <p
            v-if="incident.action === 'relay_message' && !incident.confirmable"
          >
            Передача остальных частей не подтверждена. Используйте web inbox.
          </p>
          <button
            v-if="incident.action === 'relay_message' && incident.confirmable"
            class="secondary-button"
            type="button"
            :disabled="Boolean(pendingActionId)"
            @click="$emit('resolve', incident.id, 'received')"
          >
            {{
              pendingActionId === incident.id
                ? 'Сохраняем…'
                : 'Сообщение видно в Telegram'
            }}
          </button>
          <button
            type="button"
            :disabled="Boolean(pendingActionId)"
            @click="$emit('resolve', incident.id, 'use_web')"
          >
            {{
              pendingActionId === incident.id
                ? 'Сохраняем…'
                : 'Работать в web inbox'
            }}
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>
