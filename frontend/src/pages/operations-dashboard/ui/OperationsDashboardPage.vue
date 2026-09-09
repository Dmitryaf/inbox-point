<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { useAdminSession } from '@frontend/features/admin-auth/model/use-admin-session';
import AdminLoginForm from '@frontend/features/admin-auth/ui/AdminLoginForm.vue';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl.vue';
import { useOutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/model/use-outbound-delivery-control';
import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';
import { useDeliveryRetry } from '@frontend/features/retry-delivery/model/use-delivery-retry';
import AdminPageHeader from '@frontend/widgets/admin-shell/ui/AdminPageHeader.vue';
import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview.vue';
import OperatorInbox from '@frontend/widgets/operator-inbox/ui/OperatorInbox.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const refreshIntervalMs = 30_000;
const session = useAdminSession();
const operations = useOperationsStatus(session.expireSession);
const intakeControl = ref<{ refresh: () => Promise<void> }>();
const operatorInbox = ref<{ refresh: () => Promise<void> }>();
const deliveryRetry = useDeliveryRetry(refreshAll, session.expireSession);
const deliveryControl = useOutboundDeliveryControl(
  refreshAll,
  session.expireSession,
);
let refreshTimer: ReturnType<typeof setInterval> | undefined;

watch(session.authenticated, (authenticated) => {
  stopAutomaticRefresh();
  if (!authenticated) {
    operations.clear();
    return;
  }

  void refreshAll();
  refreshTimer = setInterval(() => {
    void refreshAll();
  }, refreshIntervalMs);
});

onBeforeUnmount(stopAutomaticRefresh);

async function refreshAll(): Promise<void> {
  await Promise.all([
    operations.refresh(),
    operatorInbox.value?.refresh() ?? Promise.resolve(),
    intakeControl.value?.refresh() ?? Promise.resolve(),
  ]);
}

function stopAutomaticRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
}
</script>

<template>
  <main class="ops-shell">
    <AdminPageHeader
      :authenticated="session.authenticated.value"
      current="status"
      intro="Проверьте, работают ли каналы и доходят ли ответы."
      title="Состояние"
      @logout="session.endSession"
    />

    <section v-if="session.booting.value" class="card loading-card">
      <p>Проверяем доступ…</p>
    </section>

    <section v-else-if="!session.authenticated.value" class="auth-panel">
      <div class="auth-stack">
        <p
          v-if="session.error.value"
          class="message message--error"
          role="alert"
        >
          {{ session.error.value }}
        </p>
        <AdminLoginForm
          :pending="session.pending.value"
          @submit="session.authenticate"
        />
      </div>
    </section>

    <section v-else class="ops-workspace">
      <p v-if="session.error.value" class="message message--error" role="alert">
        {{ session.error.value }}
      </p>
      <div class="toolbar">
        <p>Состояние обновляется автоматически каждые 30 секунд.</p>
        <button
          class="secondary-button"
          :disabled="operations.loading.value"
          type="button"
          @click="refreshAll"
        >
          {{ operations.loading.value ? 'Обновляем…' : 'Обновить' }}
        </button>
      </div>

      <p
        v-if="operations.error.value"
        class="message message--error"
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
        :status="operations.status.value"
        @change-delivery-mode="deliveryControl.change"
        @resolve-delivery="deliveryRetry.resolve"
        @retry-delivery="deliveryRetry.retry"
      />
      <section v-else class="card loading-card">
        <p>Получаем состояние сервиса…</p>
      </section>

      <ClientIntakeControl
        ref="intakeControl"
        @changed="refreshAll"
        @unauthorized="session.expireSession"
      />

      <AsyncMessage kind="error" :text="deliveryRetry.error.value" />
      <AsyncMessage kind="success" :text="deliveryRetry.notice.value" />
      <AsyncMessage kind="error" :text="deliveryControl.error.value" />
      <AsyncMessage kind="success" :text="deliveryControl.notice.value" />

      <OperatorInbox
        ref="operatorInbox"
        :on-unauthorized="session.expireSession"
      />
    </section>
  </main>
</template>
