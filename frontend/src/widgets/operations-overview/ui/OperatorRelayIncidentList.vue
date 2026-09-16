<script setup lang="ts">
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';
import {
  actionButtonLabel,
  canUseWeb,
  isLifecycle,
  lifecycleResolutionLabel,
  operationLabel,
  type OperatorRelayIncidentListEmits,
  type OperatorRelayIncidentListProps,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

defineProps<OperatorRelayIncidentListProps>();
defineEmits<OperatorRelayIncidentListEmits>();
</script>

<template>
  <section
    v-if="incidents.length > 0"
    class="delivery-incidents"
    aria-labelledby="operator-relay-incidents-title"
  >
    <h3 id="operator-relay-incidents-title">Действия в Telegram</h3>
    <p>Проверьте фактическое состояние темы перед выбором действия.</p>
    <ol>
      <li v-for="incident in incidents" :key="incident.id">
        <div class="delivery-incident-heading">
          <strong>
            {{
              isLifecycle(incident)
                ? 'Состояние темы требует решения'
                : `Обращение из ${incident.channel} требует решения`
            }}
          </strong>
          <time :datetime="incident.createdAt">
            {{ formatShortDateTime(incident.createdAt) }}
          </time>
        </div>
        <p>
          {{
            isLifecycle(incident)
              ? 'Не удалось точно определить, изменилось ли состояние темы.'
              : 'Не удалось точно определить, появилось ли сообщение у операторов.'
          }}
        </p>
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
            <div v-if="incident.action !== 'open_request'">
              <dt>ID темы Telegram</dt>
              <dd>{{ incident.operatorTopicId }}</dd>
            </div>
            <div>
              <dt>Операция</dt>
              <dd>
                {{ operationLabel(incident) }}
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
              actionButtonLabel(
                pendingActionId === incident.id,
                'Сообщение есть в Telegram',
              )
            }}
          </button>
          <button
            v-if="isLifecycle(incident)"
            class="secondary-button"
            type="button"
            :disabled="Boolean(pendingActionId)"
            @click="$emit('resolve', incident.id, 'completed')"
          >
            {{
              actionButtonLabel(
                pendingActionId === incident.id,
                lifecycleResolutionLabel(incident, 'completed'),
              )
            }}
          </button>
          <button
            v-if="isLifecycle(incident)"
            type="button"
            :disabled="Boolean(pendingActionId)"
            @click="$emit('resolve', incident.id, 'not_completed')"
          >
            {{
              actionButtonLabel(
                pendingActionId === incident.id,
                lifecycleResolutionLabel(incident, 'not_completed'),
              )
            }}
          </button>
          <button
            v-if="canUseWeb(incident)"
            type="button"
            :disabled="Boolean(pendingActionId)"
            @click="$emit('resolve', incident.id, 'use_web')"
          >
            {{
              actionButtonLabel(
                pendingActionId === incident.id,
                'Открыть обращение здесь',
              )
            }}
          </button>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped src="../styles/incident-list.css"></style>
