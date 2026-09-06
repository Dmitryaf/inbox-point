<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

import { useOperationsSession } from '@frontend/features/operations-auth/model/use-operations-session';
import OperationsLoginForm from '@frontend/features/operations-auth/ui/OperationsLoginForm.vue';
import ClientIntakeControl from '@frontend/features/control-client-intake/ui/ClientIntakeControl.vue';
import { useOutboundDeliveryControl } from '@frontend/features/control-outbound-delivery/model/use-outbound-delivery-control';
import { useOperationsStatus } from '@frontend/features/refresh-status/model/use-operations-status';
import { useDeliveryRetry } from '@frontend/features/retry-delivery/model/use-delivery-retry';
import OperationsOverview from '@frontend/widgets/operations-overview/ui/OperationsOverview.vue';
import AsyncMessage from '@frontend/shared/ui/AsyncMessage.vue';

const refreshIntervalMs = 30_000;
const session = useOperationsSession();
const operations = useOperationsStatus(session.expireSession);
const intakeControl = ref<{ refresh: () => Promise<void> }>();
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

async function authenticate(password: string): Promise<void> {
  await session.authenticate(password);
}

async function logout(): Promise<void> {
  await session.endSession();
}

async function refreshAll(): Promise<void> {
  await Promise.all([
    operations.refresh(),
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
    <header class="ops-header">
      <div>
        <p class="brand">MESSENGER HANDOFF</p>
        <h1>Состояние сервиса</h1>
        <p class="page-intro">
          Проверяйте подключения и доставку ответов школы.
        </p>
      </div>
      <button
        v-if="session.authenticated.value"
        class="secondary-button"
        type="button"
        @click="logout"
      >
        Выйти
      </button>
    </header>

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
        <OperationsLoginForm
          :pending="session.pending.value"
          @submit="authenticate"
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

      <ClientIntakeControl
        ref="intakeControl"
        scope="ops"
        @changed="refreshAll"
        @unauthorized="session.expireSession"
      />

      <AsyncMessage kind="error" :text="deliveryRetry.error.value" />
      <AsyncMessage kind="success" :text="deliveryRetry.notice.value" />
      <AsyncMessage kind="error" :text="deliveryControl.error.value" />
      <AsyncMessage kind="success" :text="deliveryControl.notice.value" />

      <OperationsOverview
        v-if="operations.status.value"
        :delivery-control-pending="deliveryControl.pendingMode.value"
        :pending-delivery-id="
          deliveryRetry.pendingDeliveryId.value || undefined
        "
        :status="operations.status.value"
        @change-delivery-mode="deliveryControl.change"
        @retry-delivery="deliveryRetry.retry"
      />
      <section v-else class="card loading-card">
        <p>Получаем состояние сервиса…</p>
      </section>
    </section>
  </main>
</template>
