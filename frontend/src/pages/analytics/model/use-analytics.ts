import { onBeforeUnmount, ref, watch } from 'vue';
import { loadAnalytics } from '@frontend/entities/analytics/api/analytics-api';
import type {
  AnalyticsChannel,
  AnalyticsPeriod,
  AnalyticsReport,
} from '@frontend/entities/analytics/model/types';
import { HttpError } from '@frontend/shared/api/http-client';
export function useAnalytics(onUnauthorized: () => void) {
  const period = ref<AnalyticsPeriod>('30d');
  const channel = ref<AnalyticsChannel>('all');
  const report = ref<AnalyticsReport>();
  const loading = ref(false);
  const error = ref('');
  let controller: AbortController | undefined;
  async function refresh(): Promise<void> {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    loading.value = true;
    error.value = '';
    report.value = undefined;
    try {
      const result = await loadAnalytics(
        period.value,
        channel.value,
        current.signal,
      );
      if (!current.signal.aborted) {
        report.value = result;
      }
    } catch (reason: unknown) {
      if (current.signal.aborted) {
        return;
      }
      if (reason instanceof HttpError && reason.status === 401) {
        onUnauthorized();
      } else {
        error.value = 'Не удалось загрузить аналитику. Повторите попытку.';
      }
    } finally {
      if (!current.signal.aborted) {
        loading.value = false;
      }
    }
  }
  watch([period, channel], () => void refresh(), { immediate: true });
  onBeforeUnmount(() => controller?.abort());
  return { period, channel, report, loading, error, refresh };
}
