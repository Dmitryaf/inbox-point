import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from '@frontend/shared/lib/model-state';

import {
  loadContent,
  loadContentHistory,
  restoreContent,
  saveContent,
} from '@frontend/entities/content/api/content-api';
import {
  createEmptyContent,
  normalizeContentDraft,
  snapshotContent,
} from '@frontend/entities/content/model/content-draft';
import { HttpError } from '@frontend/shared/api/http-client';
import { errorMessage } from '@frontend/shared/lib/error-message';

interface ContentWorkspaceOptions {
  onUnauthorized(): void;
}

export function useContentWorkspace(options: ContentWorkspaceOptions) {
  const draft = reactive(createEmptyContent());
  const history = ref<Awaited<ReturnType<typeof loadContentHistory>>>([]);
  const savedSnapshot = ref(snapshotContent(draft));
  const loading = ref(true);
  const saving = ref(false);
  const restoring = ref(false);
  const error = ref('');
  const notice = ref('');
  const dirty = computed(() => snapshotContent(draft) !== savedSnapshot.value);

  const load = async (): Promise<void> => {
    loading.value = true;
    error.value = '';
    try {
      const [content, changes] = await Promise.all([
        loadContent(),
        loadContentHistory(),
      ]);
      Object.assign(draft, normalizeContentDraft(content));
      savedSnapshot.value = snapshotContent(draft);
      history.value = changes;
    } catch (cause: unknown) {
      reportFailure(cause);
    } finally {
      loading.value = false;
    }
  };

  const save = async (): Promise<void> => {
    saving.value = true;
    error.value = '';
    notice.value = '';
    try {
      await saveContent(draft);
      savedSnapshot.value = snapshotContent(draft);
      history.value = await loadContentHistory();
      notice.value = 'Информация сохранена и уже доступна клиентам.';
    } catch (cause: unknown) {
      const message = reportFailure(cause);
      if (message) {
        error.value = `${message} Ваши изменения остались на этой странице.`;
      }
    } finally {
      saving.value = false;
    }
  };

  const restore = async (revision: number): Promise<void> => {
    restoring.value = true;
    error.value = '';
    notice.value = '';
    try {
      await restoreContent(revision);
      await load();
      notice.value = 'Предыдущая версия восстановлена и уже доступна клиентам.';
    } catch (cause: unknown) {
      reportFailure(cause);
    } finally {
      restoring.value = false;
    }
  };

  const preventUnsavedExit = (event: BeforeUnloadEvent): void => {
    if (dirty.value) {
      event.preventDefault();
    }
  };
  onMounted(() => window.addEventListener('beforeunload', preventUnsavedExit));
  onBeforeUnmount(() =>
    window.removeEventListener('beforeunload', preventUnsavedExit),
  );

  function reportFailure(cause: unknown): string {
    if (cause instanceof HttpError && cause.status === 401) {
      options.onUnauthorized();
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
    history,
    load,
    loading,
    notice,
    restore,
    restoring,
    save,
    saving,
  };
}
