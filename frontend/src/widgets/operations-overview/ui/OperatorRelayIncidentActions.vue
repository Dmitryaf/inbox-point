<script setup lang="ts">
import {
  actionButtonLabel,
  canRetryHeldReply,
  canUseWeb,
  isLifecycle,
  lifecycleResolutionLabel,
  type OperatorRelayIncidentListEmits,
  type OperatorRelayIncidentListProps,
} from '@frontend/widgets/operations-overview/model/operator-action-presentation';

defineProps<
  Pick<OperatorRelayIncidentListProps, 'pendingActionId'> & {
    incident: OperatorRelayIncidentListProps['incidents'][number];
  }
>();
defineEmits<OperatorRelayIncidentListEmits>();

function isMessageDeliveryIncident(
  incident: OperatorRelayIncidentListProps['incidents'][number],
): boolean {
  return (
    incident.action === 'relay_message' ||
    incident.action === 'mirror_operator_message'
  );
}
</script>

<template>
  <div class="delivery-resolution-actions">
    <p v-if="isMessageDeliveryIncident(incident)">
      Проверьте Telegram-тему перед выбором действия.
    </p>
    <p v-if="incident.action === 'relay_message' && !incident.confirmable">
      Не все сообщения появились в Telegram. Откройте обращение здесь.
    </p>
    <button
      v-if="isMessageDeliveryIncident(incident) && incident.confirmable"
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
      v-if="isLifecycle(incident) && incident.status === 'outcome_unknown'"
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
      v-if="isLifecycle(incident) && incident.status === 'outcome_unknown'"
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
      v-if="canRetryHeldReply(incident)"
      type="button"
      :disabled="Boolean(pendingActionId)"
      @click="$emit('resolve', incident.id, 'retry')"
    >
      {{
        actionButtonLabel(
          pendingActionId === incident.id,
          'Повторить открытие темы',
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
</template>

<style scoped src="../styles/incident-list.css"></style>
