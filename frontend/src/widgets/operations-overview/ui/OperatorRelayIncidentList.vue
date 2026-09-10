<script setup lang="ts">
import type { OperatorRelayIncident } from '@frontend/entities/operations/model/types';
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';

defineProps<{
  incidents: readonly OperatorRelayIncident[];
  pendingActionId: string | undefined;
}>();
defineEmits<{
  resolve: [actionId: string, resolution: 'received' | 'use_web'];
}>();
</script>

<template>
  <section
    v-if="incidents.length > 0"
    class="delivery-incidents"
    aria-labelledby="operator-relay-incidents-title"
  >
    <h3 id="operator-relay-incidents-title">Новые обращения</h3>
    <p>Проверьте, появилось ли обращение у операторов в Telegram.</p>
    <ol>
      <li v-for="incident in incidents" :key="incident.id">
        <div class="delivery-incident-heading">
          <strong>Обращение из {{ incident.channel }} требует решения</strong>
          <time :datetime="incident.createdAt">
            {{ formatShortDateTime(incident.createdAt) }}
          </time>
        </div>
        <p>Не удалось точно определить, появилось ли сообщение у операторов.</p>
        <details class="technical-details">
          <summary>Технические данные</summary>
          <dl class="delivery-incident-context">
            <div>
              <dt>ID обращения</dt>
              <dd>{{ incident.requestId }}</dd>
            </div>
            <div>
              <dt>Причина</dt>
              <dd>{{ incident.reason }}</dd>
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
            Не все сообщения появились в Telegram. Откройте обращение здесь.
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
                : 'Сообщение есть в Telegram'
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
                : 'Открыть обращение здесь'
            }}
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped src="../styles/incident-list.css"></style>
