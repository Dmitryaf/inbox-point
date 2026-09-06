<script setup lang="ts">
import { computed } from 'vue';

import { formatUptime } from '@frontend/entities/operations/lib/status-format';
import type { OperationsStatus } from '@frontend/entities/operations/model/types';
import ChannelStatusCard from './ChannelStatusCard.vue';
import DeliveryStatusCard from './DeliveryStatusCard.vue';

const props = defineProps<{
  deliveryControlPending: 'pause' | 'resume' | undefined;
  pendingDeliveryId: string | undefined;
  status: OperationsStatus;
}>();
defineEmits<{
  changeDeliveryMode: [mode: 'pause' | 'resume'];
  resolveDelivery: [
    deliveryId: string,
    resolution: 'not_received' | 'received',
  ];
  retryDelivery: [deliveryId: string];
}>();

const observedAt = computed(() =>
  new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(props.status.observedAt)),
);
const overallLabel = computed(() => {
  if (props.status.state === 'healthy') {
    return 'Сервис работает';
  }
  if (props.status.state === 'attention') {
    return 'Нужно проверить';
  }
  return props.status.outbound.mode === 'paused'
    ? 'Доставка ответов остановлена'
    : 'Приём обращений приостановлен';
});
</script>

<template>
  <section class="overview" aria-labelledby="overview-title">
    <article
      class="summary-card card"
      :class="{
        'summary-card--attention': status.state === 'attention',
        'summary-card--maintenance': status.state === 'maintenance',
      }"
    >
      <div>
        <p class="eyebrow">Общее состояние</p>
        <h2 id="overview-title">
          {{ overallLabel }}
        </h2>
      </div>
      <dl class="summary-facts">
        <div>
          <dt>Работает без перезапуска</dt>
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
      <DeliveryStatusCard
        :deliveries="status.deliveries"
        :delivery-control-pending="deliveryControlPending"
        :outbound="status.outbound"
        :pending-delivery-id="pendingDeliveryId"
        @change-delivery-mode="$emit('changeDeliveryMode', $event)"
        @resolve="(id, resolution) => $emit('resolveDelivery', id, resolution)"
        @retry="$emit('retryDelivery', $event)"
      />
    </div>
  </section>
</template>
