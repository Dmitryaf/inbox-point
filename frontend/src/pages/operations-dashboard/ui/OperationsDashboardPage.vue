<script setup lang="ts">
import { useTemplateRef } from 'vue';

import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl.vue';
import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';
import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview.vue';
import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const intakeControl = useTemplateRef<{ refresh: () => Promise<void> }>(
  'intakeControl',
);
const operatorInbox = useTemplateRef<{ refresh: () => Promise<void> }>(
  'operatorInbox',
);
const session = useAdminShellSession();

const {
  deliveryControl,
  deliveryRetry,
  inboundEventResolution,
  operations,
  operatorResolution,
  refreshAll,
} = useOperationsDashboard({ intakeControl, operatorInbox, session });
</script>

<template>
  <section v-if="session.authenticated.value" class="ops-workspace">
    <p
      v-if="operations.error.value"
      class="message message--error card"
      role="alert"
    >
      {{ operations.error.value }}
    </p>

    <div class="ops-toolbar">
      <p>Автообновление каждые 30 секунд</p>
      <button
        class="quiet"
        :disabled="operations.loading.value"
        type="button"
        @click="refreshAll"
      >
        {{ operations.loading.value ? 'Обновляем…' : 'Обновить' }}
      </button>
    </div>

    <OperatorInbox
      ref="operatorInbox"
      :on-unauthorized="session.expireSession"
    />

    <OperationsOverview
      v-if="operations.status.value"
      :delivery-control-pending="deliveryControl.pendingMode.value"
      :pending-delivery-id="deliveryRetry.pendingDeliveryId.value || undefined"
      :pending-operator-action-id="
        operatorResolution.pendingActionId.value || undefined
      "
      :pending-inbound-event-id="
        inboundEventResolution.pendingEventId.value || undefined
      "
      :status="operations.status.value"
      @change-delivery-mode="deliveryControl.change"
      @resolve-delivery="deliveryRetry.resolve"
      @retry-delivery="deliveryRetry.retry"
      @resolve-operator-action="operatorResolution.resolve"
      @resolve-inbound-event="inboundEventResolution.resolve"
    />
    <section v-else class="card loading-card" role="status">
      <p>Проверяем работу каналов…</p>
    </section>

    <ClientIntakeControl
      ref="intakeControl"
      @changed="refreshAll"
      @unauthorized="session.expireSession"
    />

    <AsyncMessage kind="error" :text="deliveryRetry.error.value" />
    <AsyncMessage kind="success" :text="deliveryRetry.notice.value" />
    <AsyncMessage kind="error" :text="operatorResolution.error.value" />
    <AsyncMessage kind="success" :text="operatorResolution.notice.value" />
    <AsyncMessage kind="error" :text="deliveryControl.error.value" />
    <AsyncMessage kind="success" :text="deliveryControl.notice.value" />

    <AsyncMessage kind="error" :text="inboundEventResolution.error.value" />
    <AsyncMessage kind="success" :text="inboundEventResolution.notice.value" />
  </section>
</template>

<style scoped src="../styles/operations-dashboard-page.css"></style>
