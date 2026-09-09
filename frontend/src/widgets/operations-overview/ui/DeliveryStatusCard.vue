<script setup lang="ts">
import { computed } from 'vue';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import DeliveryIncidentList from './DeliveryIncidentList.vue';
import OperatorRelayIncidentList from './OperatorRelayIncidentList.vue';
import OutboundDeliveryControl from './OutboundDeliveryControl.vue';

const props = defineProps<{
  deliveries: OperationsStatus['deliveries'];
  deliveryControlPending: 'pause' | 'resume' | undefined;
  outbound: OperationsStatus['outbound'];
  operatorRelays: OperationsStatus['operatorRelays'];
  pendingOperatorActionId: string | undefined;
  pendingDeliveryId: string | undefined;
}>();
defineEmits<{
  changeDeliveryMode: [mode: 'pause' | 'resume'];
  resolve: [deliveryId: string, resolution: 'not_received' | 'received'];
  retry: [deliveryId: string];
  resolveOperatorAction: [actionId: string, resolution: 'received' | 'use_web'];
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
    <DeliveryIncidentList
      :incidents="deliveries.incidents"
      :pending-delivery-id="pendingDeliveryId"
      @resolve="(id, resolution) => $emit('resolve', id, resolution)"
      @retry="$emit('retry', $event)"
    />
    <OperatorRelayIncidentList
      :incidents="operatorRelays.incidents"
      :pending-action-id="pendingOperatorActionId"
      @resolve="
        (id, resolution) => $emit('resolveOperatorAction', id, resolution)
      "
    />
  </article>
</template>
