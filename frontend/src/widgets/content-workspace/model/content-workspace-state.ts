import { computed, reactive, ref } from 'vue';

import {
  createEmptyContent,
  snapshotContent,
} from '@frontend/entities/content/model/content-draft';
import { requestErrorMessage } from '@frontend/shared/lib/request-error-message';
import { preserveContentDraft } from '@frontend/widgets/content-workspace/model/content-draft-recovery';

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
    const message = requestErrorMessage(cause, () => {
      if (dirty.value) {
        preserveContentDraft(draft, savedSnapshot.value, version.value);
      }
      onUnauthorized();
    });
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
