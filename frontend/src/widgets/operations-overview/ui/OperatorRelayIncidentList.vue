<script setup lang="ts">
import { formatShortDateTime } from '@frontend/shared/lib/format-date-time';
import {
  isLifecycle,
  operationLabel,
  type OperatorRelayIncidentListEmits,
  type OperatorRelayIncidentListProps,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';
import OperatorRelayIncidentActions from './OperatorRelayIncidentActions.vue';

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
    <p>Проверьте ситуацию и выберите доступное безопасное действие.</p>
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
        <p v-if="incident.heldReplyCount > 0">
          {{ incident.reason }}
        </p>
        <p v-else>
          {{
            isLifecycle(incident)
              ? 'Не удалось точно определить, изменилось ли состояние темы.'
              : 'Не удалось точно определить, появилось ли сообщение у администраторов.'
          }}
        </p>
        <p v-if="incident.heldReplyCount > 1">
          Сохранено ответов: {{ incident.heldReplyCount }}. Они будут отправлены
          по порядку.
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
              <dt>
                {{
                  incident.action === 'mirror_operator_message'
                    ? 'ID ответа VK'
                    : 'ID сообщения клиента'
                }}
              </dt>
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
        <OperatorRelayIncidentActions
          :incident="incident"
          :pending-action-id="pendingActionId"
          @resolve="(id, resolution) => $emit('resolve', id, resolution)"
        />
      </li>
    </ol>
  </section>
</template>

<style scoped src="../styles/incident-list.css"></style>
