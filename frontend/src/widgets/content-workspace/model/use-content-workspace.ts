import {
  loadContent,
  restoreContent,
  saveContent,
} from '@frontend/entities/content/api/content-api';
import {
  copyContentDraft,
  normalizeContentDraft,
  snapshotContent,
} from '@frontend/entities/content/model/content-draft';
import { createContentWorkspaceState } from './content-workspace-state';
import { useContentHistory } from './use-content-history';
import { useUnsavedExitGuard } from './use-unsaved-exit-guard';

interface ContentWorkspaceOptions {
  onUnauthorized: () => void;
}

export function useContentWorkspace(options: ContentWorkspaceOptions) {
  const state = createContentWorkspaceState(options.onUnauthorized);
  const historyState = useContentHistory((cause) => state.reportFailure(cause));
  useUnsavedExitGuard(state.dirty);

  const load = async (): Promise<void> => {
    state.loading.value = true;
    state.error.value = '';
    state.notice.value = '';
    try {
      const snapshot = await loadContent();
      Object.assign(state.draft, normalizeContentDraft(snapshot.content));
      state.savedSnapshot.value = snapshotContent(state.draft);
      state.version.value = snapshot.version;
      state.loaded.value = true;
    } catch (cause: unknown) {
      state.reportFailure(cause);
      return;
    } finally {
      state.loading.value = false;
    }
    await refreshHistory(
      'Информация загружена, но историю изменений обновить не удалось.',
    );
  };

  const save = async (): Promise<void> => {
    state.saving.value = true;
    state.error.value = '';
    state.notice.value = '';
    const submission = copyContentDraft(state.draft);
    const submittedSnapshot = snapshotContent(submission);
    let saved = false;
    try {
      const result = await saveContent(submission, state.version.value);
      const savedContent = normalizeContentDraft(result.content);
      state.version.value = result.version;
      state.savedSnapshot.value = snapshotContent(savedContent);
      if (snapshotContent(state.draft) === submittedSnapshot) {
        Object.assign(state.draft, savedContent);
      }
      state.notice.value = 'Информация сохранена и уже доступна клиентам.';
      saved = true;
    } catch (cause: unknown) {
      const message = state.reportFailure(cause);
      if (message) {
        state.error.value = `${message} Ваши изменения остались на этой странице.`;
      }
    } finally {
      state.saving.value = false;
    }
    if (saved) {
      await refreshHistory(
        'Информация сохранена, но историю изменений обновить не удалось.',
      );
    }
  };

  const restore = async (revision: number): Promise<void> => {
    state.restoring.value = true;
    state.error.value = '';
    state.notice.value = '';
    let restored = false;
    try {
      const result = await restoreContent(revision, state.version.value);
      Object.assign(state.draft, normalizeContentDraft(result.content));
      state.savedSnapshot.value = snapshotContent(state.draft);
      state.version.value = result.version;
      state.notice.value =
        'Предыдущая версия восстановлена и уже доступна клиентам.';
      restored = true;
    } catch (cause: unknown) {
      state.reportFailure(cause);
    } finally {
      state.restoring.value = false;
    }
    if (restored) {
      await refreshHistory(
        'Версия восстановлена, но историю изменений обновить не удалось.',
      );
    }
  };

  const resumeAfterAuthentication = async (): Promise<void> => {
    if (!state.loaded.value) {
      await load();
      return;
    }
    if (!historyState.historyLoaded.value) {
      await refreshHistory('Историю изменений обновить не удалось.');
    }
  };

  async function refreshHistory(failurePrefix: string): Promise<void> {
    const message = await historyState.refreshHistory();
    if (message) {
      state.error.value = `${failurePrefix} ${message}`;
    }
  }

  return {
    ...state,
    history: historyState.history,
    historyLoading: historyState.historyLoading,
    load,
    restore,
    resumeAfterAuthentication,
    save,
  };
}
