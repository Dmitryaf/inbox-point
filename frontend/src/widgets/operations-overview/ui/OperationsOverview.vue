<script setup lang="ts">
import { computed } from 'vue';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import { formatShortDateTimeWithSeconds } from '@frontend/shared/lib/format-date-time';
import ChannelStatusCard from './ChannelStatusCard.vue';
import DeliveryStatusCard from './DeliveryStatusCard.vue';
import InboundEventStatusCard from './InboundEventStatusCard.vue';
import OperationsAttentionPanel from './OperationsAttentionPanel.vue';

const props = defineProps<{
  pendingDeliveryId: string | undefined;
  pendingOperatorActionId: string | undefined;
  pendingInboundEventId: string | undefined;
  status: OperationsStatus;
  statusUnavailable?: boolean;
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

const observedAt = computed(() =>
  formatShortDateTimeWithSeconds(props.status.observedAt),
);
const overallLabel = computed(() => {
  if (props.statusUnavailable) {
    return 'Состояние неизвестно';
  }
  if (props.status.state === 'healthy') {
    return 'Всё работает';
  }
  if (props.status.state === 'attention') {
    return 'Нужно проверить';
  }
  return props.status.outbound.mode === 'paused'
    ? 'Ответы клиентам приостановлены'
    : 'Приём обращений приостановлен';
});
const overallDescription = computed(() => {
  if (props.statusUnavailable) {
    return `Не удалось обновить состояние. Показаны последние данные от ${observedAt.value}.`;
  }
  if (props.status.state === 'healthy') {
    return 'Всё работает: каналы принимают сообщения, ответы отправляются.';
  }
  if (props.status.state === 'attention') {
    return 'Выше показано, что не работает и что нужно сделать.';
  }
  return props.status.outbound.mode === 'paused'
    ? 'Ответы сохраняются и будут отправлены после возобновления.'
    : 'Новые обращения временно не создаются, активные диалоги продолжаются.';
});
</script>

<template>
  <section class="overview" aria-labelledby="overview-title">
    <OperationsAttentionPanel
      :pending-delivery-id="pendingDeliveryId"
      :pending-inbound-event-id="pendingInboundEventId"
      :pending-operator-action-id="pendingOperatorActionId"
      :status="status"
      @resolve-delivery="
        (id, resolution) => $emit('resolveDelivery', id, resolution)
      "
      @retry-delivery="$emit('retryDelivery', $event)"
      @resolve-operator-action="
        (id, resolution) => $emit('resolveOperatorAction', id, resolution)
      "
      @resolve-inbound-event="
        (id, source, resolution) =>
          $emit('resolveInboundEvent', id, source, resolution)
      "
    />

    <article
      class="service-summary"
      :class="{
        'summary-card--attention':
          statusUnavailable || status.state === 'attention',
        'summary-card--maintenance': status.state === 'maintenance',
      }"
    >
      <div>
        <h2 id="overview-title">
          {{ overallLabel }}
        </h2>
        <p class="summary-description">{{ overallDescription }}</p>
      </div>
      <dl class="summary-facts">
        <div>
          <dt>Работает</dt>
          <dd>{{ formatUptime(status.uptimeSeconds) }}</dd>
        </div>
        <div>
          <dt>Данные обновлены</dt>
          <dd>{{ observedAt }}</dd>
        </div>
      </dl>
    </article>

    <div class="status-grid">
      <ChannelStatusCard
        name="Telegram"
        :channel="status.channels.telegram"
        :intake="status.intake.telegram"
      />
      <ChannelStatusCard
        name="VK"
        :channel="status.channels.vk"
        :intake="status.intake.vk"
      />
      <DeliveryStatusCard :deliveries="status.deliveries" />
      <InboundEventStatusCard :inbound-events="status.inboundEvents" />
    </div>
  </section>
</template>

<style scoped src="../styles/operations-overview.css"></style>
