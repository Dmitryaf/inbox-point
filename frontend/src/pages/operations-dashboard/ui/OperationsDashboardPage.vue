<script setup lang="ts">
import { useTemplateRef, watch } from 'vue';

import { openAdminLogin } from '@frontend/features/admin-auth/lib/auth-navigation';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl.vue';
import { useOperationsDashboard } from '@frontend/pages/operations-dashboard/model/use-operations-dashboard';
import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';
import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview.vue';
import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const intakeControl = useTemplateRef<{ refresh: () => Promise<void> }>(
  'intakeControl',
);
const operatorInbox = useTemplateRef<{ refresh: () => Promise<void> }>(
  'operatorInbox',
);

const {
  deliveryControl,
  deliveryRetry,
  inboundEventResolution,
  operations,
  operatorResolution,
  refreshAll,
  session,
} = useOperationsDashboard({ intakeControl, operatorInbox });

watch(
  [session.booting, session.authenticated],
  ([booting, authenticated]) => {
    if (!booting && !authenticated) {
      openAdminLogin('/ops');
    }
  },
  { immediate: true },
);

async function logOut(): Promise<void> {
  await session.endSession();
}
</script>

<template>
  <main class="ops-shell">
    <AdminPageHeader
      v-if="session.authenticated.value"
      :authenticated="session.authenticated.value"
      current="status"
      intro="Проверьте, работают ли каналы и доходят ли ответы."
      title="Состояние"
      @logout="logOut"
    />

    <section
      v-if="session.booting.value"
      class="card loading-card"
      role="status"
    >
      <p>Проверяем доступ…</p>
    </section>

    <section v-else-if="session.authenticated.value" class="ops-workspace">
      <p
        v-if="session.error.value"
        class="message message--error card"
        role="alert"
      >
        {{ session.error.value }}
      </p>
      <p
        v-if="operations.error.value"
        class="message message--error card"
        role="alert"
      >
        {{ operations.error.value }}
      </p>

      <OperationsOverview
        v-if="operations.status.value"
        :delivery-control-pending="deliveryControl.pendingMode.value"
        :pending-delivery-id="
          deliveryRetry.pendingDeliveryId.value || undefined
        "
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

      <div class="toolbar">
        <p>Данные обновляются автоматически каждые 30 секунд.</p>
        <button
          class="secondary-button"
          :disabled="operations.loading.value"
          type="button"
          @click="refreshAll"
        >
          {{ operations.loading.value ? 'Обновляем…' : 'Обновить' }}
        </button>
      </div>

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

      <OperatorInbox
        ref="operatorInbox"
        :on-unauthorized="session.expireSession"
      />
      <AsyncMessage kind="error" :text="inboundEventResolution.error.value" />
      <AsyncMessage
        kind="success"
        :text="inboundEventResolution.notice.value"
      />
    </section>
  </main>
</template>

<style scoped src="../styles/operations-dashboard-page.css"></style>
