<script setup lang="ts">
import { computed } from 'vue';
import { useAdminShellSession } from '@frontend/features/admin-auth/model/admin-session-context';
import { useAnalytics } from '@frontend/pages/analytics/model/use-analytics';
import AnalyticsOverview from '@frontend/widgets/analytics-overview/ui/AnalyticsOverview.vue';
const session = useAdminShellSession();
const { period, channel, report, loading, error, refresh } = useAnalytics(
  session.expireSession,
);
const empty = computed(
  () =>
    report.value &&
    report.value.summary.requests === 0 &&
    report.value.summary.menuActions === 0,
);
const periods = [
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '90d', label: '90 дней' },
] as const;
const channels = [
  { value: 'all', label: 'Все каналы' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'vk', label: 'VK' },
] as const;
</script>
<template>
  <section class="analytics-page" aria-label="Использование ботов">
    <div class="analytics-filters">
      <div role="group" aria-label="Период">
        <button
          v-for="item in periods"
          :key="item.value"
          class="quiet"
          type="button"
          :aria-pressed="period === item.value"
          @click="period = item.value"
        >
          {{ item.label }}
        </button>
      </div>
      <div role="group" aria-label="Канал">
        <button
          v-for="item in channels"
          :key="item.value"
          class="quiet"
          type="button"
          :aria-pressed="channel === item.value"
          @click="channel = item.value"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <section v-if="loading" class="card" role="status">
      <p>Загружаем аналитику…</p>
    </section>
    <section v-else-if="error" class="card message--error" role="alert">
      <p>{{ error }}</p>
      <button class="quiet" type="button" @click="refresh">
        Повторить попытку
      </button>
    </section>
    <section v-else-if="empty" class="card analytics-empty" role="status">
      <h2>Пока нет активности</h2>
      <p>За выбранный период в этих каналах нет обращений и действий меню.</p>
      <p>
        Когда пользователи начнут взаимодействовать с ботами, здесь появится
        статистика.
      </p>
    </section>
    <AnalyticsOverview v-else-if="report" :report="report" />
  </section>
</template>
<style scoped src="../styles/analytics-page.css"></style>
