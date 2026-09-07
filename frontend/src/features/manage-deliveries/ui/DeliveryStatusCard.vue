<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  readDeliveryStatus,
  retryDelivery,
} from '@frontend/entities/setup/api/setup-api';
import type { DeliveryStatus } from '@frontend/entities/setup/model/types';
import { errorMessage } from '@frontend/shared/lib/error-message';

const refreshIntervalMs = 10_000;
const status = ref<DeliveryStatus>();
const message = ref('');
const loading = ref(false);
const retryingId = ref('');
let refreshTimer: ReturnType<typeof setInterval> | undefined;

const summary = computed(() => {
  if (!status.value) {
    return 'Проверяем состояние доставки…';
  }
  const { failed, pending, uncertain = 0 } = status.value.summary;
  if (failed === 0 && pending === 0) {
    return 'Все ответы доставлены.';
  }
  const manualCheck =
    uncertain > 0 ? ` Требуют ручной проверки: ${uncertain}.` : '';
  return `Ожидают отправки: ${pending}. Не доставлено: ${failed}.${manualCheck}`;
});

onMounted(() => {
  void refresh();
  refreshTimer = setInterval(() => void refresh(), refreshIntervalMs);
});
onBeforeUnmount(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
});

async function refresh(): Promise<void> {
  loading.value = true;
  try {
    status.value = await readDeliveryStatus();
    message.value = '';
  } catch {
    message.value = 'Не удалось проверить доставку. Обновите страницу.';
  } finally {
    loading.value = false;
  }
}

async function retry(deliveryId: string): Promise<void> {
  retryingId.value = deliveryId;
  message.value = 'Возвращаем ответ в очередь…';
  try {
    await retryDelivery(deliveryId);
    await refresh();
  } catch (cause: unknown) {
    message.value = errorMessage(cause);
  } finally {
    retryingId.value = '';
  }
}
</script>

<template>
  <section class="setup-card card" aria-labelledby="delivery-title">
    <p class="step">Контроль</p>
    <h2 id="delivery-title">Доставка ответов</h2>
    <p class="setup-lead" role="status">{{ message || summary }}</p>
    <ul v-if="status?.failures.length" class="delivery-failures">
      <li v-for="failure in status.failures" :key="failure.id">
        <div>
          <strong>{{ failure.channel }}</strong>
          <p>{{ failure.reason }}</p>
          <small>Попыток: {{ failure.attempts }}</small>
        </div>
        <button
          v-if="failure.retryAllowed"
          class="secondary-button"
          :disabled="retryingId !== ''"
          type="button"
          @click="retry(failure.id)"
        >
          {{ retryingId === failure.id ? 'Возвращаем…' : 'Повторить' }}
        </button>
        <span v-else class="status-pill status-pill--attention">
          Проверить вручную
        </span>
      </li>
    </ul>
    <button class="secondary-button" :disabled="loading" @click="refresh">
      {{ loading ? 'Обновляем…' : 'Обновить' }}
    </button>
    <p class="setup-note">
      Тексты сообщений и имена отправителей здесь не отображаются.
    </p>
  </section>
</template>
