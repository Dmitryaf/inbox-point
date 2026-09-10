<script setup lang="ts">
import { useTemplateRef } from 'vue';

import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';
import MessageFlowControl from '@frontend/widgets/message-flow-control/ui/MessageFlowControl.vue';
import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview.vue';
import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const intakeControl = useTemplateRef<{ refresh: () => Promise<string> }>(
  'intakeControl',
);
const operatorInbox = useTemplateRef<{ refresh: () => Promise<string> }>(
  'operatorInbox',
);
const session = useAdminShellSession();

const {
  deliveryControl,
  deliveryRetry,
  inboundEventResolution,
  operations,
  operatorResolution,
  refreshError,
  refreshAll,
} = useOperationsDashboard({ intakeControl, operatorInbox, session });
</script>

<template>
  <section v-if="session.authenticated.value" class="ops-workspace">
    <section
      v-if="refreshError"
      class="message message--error card ops-refresh-error"
      role="alert"
    >
      <p>{{ refreshError }}</p>
      <button
        class="quiet"
        type="button"
        :disabled="operations.loading.value"
        @click="refreshAll"
      >
        Повторить проверку
      </button>
    </section>

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
      :pending-delivery-id="deliveryRetry.pendingDeliveryId.value || undefined"
      :pending-operator-action-id="
        operatorResolution.pendingActionId.value || undefined
      "
      :pending-inbound-event-id="
        inboundEventResolution.pendingEventId.value || undefined
      "
      :status="operations.status.value"
      :status-unavailable="Boolean(operations.error.value)"
      @resolve-delivery="deliveryRetry.resolve"
      @retry-delivery="deliveryRetry.retry"
      @resolve-operator-action="operatorResolution.resolve"
      @resolve-inbound-event="inboundEventResolution.resolve"
    />
    <section v-else class="card loading-card" role="status">
      <p>Проверяем работу каналов…</p>
    </section>

    <MessageFlowControl
      v-if="operations.status.value"
      ref="intakeControl"
      :outbound="operations.status.value.outbound"
      :outbound-pending="deliveryControl.pendingMode.value"
      @changed="refreshAll"
      @change-delivery-mode="deliveryControl.change"
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
