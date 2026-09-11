<script setup lang="ts">
import { computed } from 'vue';

import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import {
  channelProblem,
  type ChannelProblem,
} from '@frontend/widgets/operations-overview/model/operations-attention';
import ConnectionSetupGuide from './ConnectionSetupGuide.vue';
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
const setupProblems = computed(() =>
  channelProblems.value.filter((problem) => problem.kind === 'setup'),
);
const connectionProblems = computed(() =>
  channelProblems.value.filter((problem) => problem.kind === 'connection'),
);
const hasOperationalProblems = computed(
  () =>
    connectionProblems.value.length > 0 ||
    deliveryStopped.value ||
    props.status.deliveries.incidents.length > 0 ||
    props.status.operatorRelays.incidents.length > 0 ||
    props.status.inboundEvents.incidents.length > 0,
);
const hasAttention = computed(
  () =>
    channelProblems.value.length > 0 ||
    deliveryStopped.value ||
    props.status.deliveries.incidents.length > 0 ||
    props.status.operatorRelays.incidents.length > 0 ||
    props.status.inboundEvents.incidents.length > 0,
);
</script>

<template>
  <section
    v-if="hasAttention"
    class="attention-panel card"
    :class="{ 'attention-panel--setup-only': !hasOperationalProblems }"
    aria-labelledby="attention-title"
    aria-live="polite"
  >
    <header class="attention-panel-heading">
      <p class="eyebrow">
        {{ hasOperationalProblems ? 'Сначала проверьте это' : 'Первый запуск' }}
      </p>
      <h2 id="attention-title">
        {{
          hasOperationalProblems ? 'Требует внимания' : 'Закончите подключение'
        }}
      </h2>
      <p>
        {{
          hasOperationalProblems
            ? 'Здесь собраны только проблемы, для которых нужно ваше решение.'
            : 'Подключите каналы один раз — после этого Inbox Point начнёт принимать сообщения клиентов.'
        }}
      </p>
    </header>

    <ConnectionSetupGuide
      v-if="setupProblems.length"
      :problems="setupProblems"
    />

    <div v-if="connectionProblems.length" class="attention-list">
      <article v-for="problem in connectionProblems" :key="problem.name">
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
