import { computed, reactive, ref } from '@frontend/shared/lib/model-state';

import {
  createEmptyContent,
  snapshotContent,
} from '@frontend/entities/content/model/content-draft';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

export function createContentWorkspaceState(onUnauthorized: () => void) {
  const draft = reactive(createEmptyContent());
  const savedSnapshot = ref(snapshotContent(draft));
  const version = ref('');
  const loaded = ref(false);
  const loading = ref(true);
  const saving = ref(false);
  const restoring = ref(false);
  const error = ref('');
  const notice = ref('');
  const dirty = computed(() => snapshotContent(draft) !== savedSnapshot.value);

  function reportFailure(cause: unknown): string {
    if (cause instanceof HttpError && cause.status === 401) {
      onUnauthorized();
      return '';
    }
    const message = errorMessage(cause);
    error.value = message;
    return message;
  }

  return {
    dirty,
    draft,
    error,
    loaded,
    loading,
    notice,
    reportFailure,
    restoring,
    savedSnapshot,
    saving,
    version,
  };
}
