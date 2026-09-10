<script setup lang="ts">
import { computed } from 'vue';

import type {
  ChannelOperationsStatus,
  OperationsStatus,
} from '@frontend/entities/operations/model/types';
import DeliveryIncidentList from './DeliveryIncidentList.vue';
import InboundEventIncidentList from './InboundEventIncidentList.vue';
import OperatorRelayIncidentList from './OperatorRelayIncidentList.vue';

const props = defineProps<{
  pendingDeliveryId: string | undefined;
  pendingInboundEventId: string | undefined;
  pendingOperatorActionId: string | undefined;
  status: OperationsStatus;
}>();
defineEmits<{
  resolveDelivery: [
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ];
  retryDelivery: [deliveryId: string];
  resolveOperatorAction: [actionId: string, resolution: 'received' | 'use_web'];
  resolveInboundEvent: [
    eventId: string,
    source: string,
    resolution: 'retry' | 'skip',
  ];
}>();

interface ChannelProblem {
  action: string;
  name: string;
  summary: string;
}

const channelProblems = computed<ChannelProblem[]>(() =>
  [
    channelProblem('Telegram', props.status.channels.telegram),
    channelProblem('VK', props.status.channels.vk),
  ].filter((problem): problem is ChannelProblem => Boolean(problem)),
);
const deliveryStopped = computed(
  () =>
    props.status.deliveries.state === 'stalled' ||
    !props.status.deliveries.worker.running,
);
const hasAttention = computed(
  () =>
    channelProblems.value.length > 0 ||
    deliveryStopped.value ||
    props.status.deliveries.incidents.length > 0 ||
    props.status.operatorRelays.incidents.length > 0 ||
    props.status.inboundEvents.incidents.length > 0,
);

function channelProblem(
  name: string,
  channel: ChannelOperationsStatus,
): ChannelProblem | undefined {
  if (channel.state === 'running' || channel.state === 'starting') {
    return undefined;
  }
  if (channel.state === 'not_configured') {
    return {
      action: 'Откройте раздел «Каналы» и завершите подключение.',
      name: `${name} не подключён`,
      summary: 'Сообщения из этого канала сейчас не принимаются.',
    };
  }
  return {
    action:
      'Обновите состояние. Если связь не восстановилась, проверьте подключение канала.',
    name: `Нет связи с ${name}`,
    summary: 'Новые сообщения из этого канала могут не поступать.',
  };
}
</script>

<template>
  <section
    v-if="hasAttention"
    class="attention-panel card"
    aria-labelledby="attention-title"
    aria-live="polite"
  >
    <header class="attention-panel-heading">
      <p class="eyebrow">Сначала проверьте это</p>
      <h2 id="attention-title">Требует внимания</h2>
      <p>Здесь собраны только проблемы, для которых нужно ваше решение.</p>
    </header>

    <div v-if="channelProblems.length" class="attention-list">
      <article v-for="problem in channelProblems" :key="problem.name">
        <h3>{{ problem.name }}</h3>
        <p>{{ problem.summary }}</p>
        <p>{{ problem.action }}</p>
        <RouterLink to="/setup">Открыть «Каналы»</RouterLink>
      </article>
    </div>

    <div v-if="deliveryStopped" class="attention-list">
      <article>
        <h3>Ответы сейчас не отправляются</h3>
        <p>Сохранённые ответы останутся в системе.</p>
        <p>
          Обновите страницу. Если отправка не началась, обратитесь к тому, кто
          установил приложение.
        </p>
      </article>
    </div>

    <DeliveryIncidentList
      :incidents="status.deliveries.incidents"
      :pending-delivery-id="pendingDeliveryId"
      @resolve="(id, resolution) => $emit('resolveDelivery', id, resolution)"
      @retry="$emit('retryDelivery', $event)"
    />
    <OperatorRelayIncidentList
      :incidents="status.operatorRelays.incidents"
      :pending-action-id="pendingOperatorActionId"
      @resolve="
        (id, resolution) => $emit('resolveOperatorAction', id, resolution)
      "
    />
    <InboundEventIncidentList
      :incidents="status.inboundEvents.incidents"
      :pending-event-id="pendingInboundEventId"
      @resolve="
        (id, source, resolution) =>
          $emit('resolveInboundEvent', id, source, resolution)
      "
    />
  </section>
</template>

<style scoped src="../styles/operations-attention-panel.css"></style>
