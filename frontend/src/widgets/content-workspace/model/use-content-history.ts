import { ref } from '@frontend/shared/lib/model-state';

import { loadContentHistory } from '@frontend/entities/content/api/content-api';

export function useContentHistory(reportFailure: (cause: unknown) => string) {
  const history = ref<Awaited<ReturnType<typeof loadContentHistory>>>([]);
  const historyLoaded = ref(false);
  const historyLoading = ref(false);

  async function refreshHistory(): Promise<string | undefined> {
    historyLoading.value = true;
    try {
      history.value = await loadContentHistory();
      historyLoaded.value = true;
    } catch (cause: unknown) {
      historyLoaded.value = false;
      const message = reportFailure(cause);
      if (message) {
        return message;
      }
    } finally {
      historyLoading.value = false;
    }
  }

  return { history, historyLoaded, historyLoading, refreshHistory };
}
