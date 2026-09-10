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
import { takeContentDraftRecovery } from './content-draft-recovery';
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
      const savedContent = normalizeContentDraft(snapshot.content);
      const recovery = takeContentDraftRecovery();
      Object.assign(state.draft, recovery?.draft ?? savedContent);
      state.savedSnapshot.value =
        recovery?.savedSnapshot ?? snapshotContent(savedContent);
      state.version.value = recovery?.version ?? snapshot.version;
      if (recovery) {
        state.notice.value = 'Несохранённый черновик восстановлен.';
      }
      state.loaded.value = true;
    } catch (cause: unknown) {
      state.reportFailure(cause);
      return;
    } finally {
      state.loading.value = false;
    }
    await refreshHistory(
      'Информация загружена, но историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.',
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
      state.notice.value = 'Информация сохранена и уже доступна в каналах.';
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
        'Информация сохранена, но историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.',
      );
    }
  };

  const restore = async (revision: number): Promise<void> => {
    state.restoring.value = true;
    state.error.value = '';
    state.notice.value = '';
    const draftAtStart = snapshotContent(state.draft);
    let restored = false;
    try {
      const result = await restoreContent(revision, state.version.value);
      const restoredContent = normalizeContentDraft(result.content);
      const restoredSnapshot = snapshotContent(restoredContent);
      if (snapshotContent(state.draft) === draftAtStart) {
        Object.assign(state.draft, restoredContent);
      }
      state.savedSnapshot.value = restoredSnapshot;
      state.version.value = result.version;
      state.notice.value =
        snapshotContent(state.draft) === restoredSnapshot
          ? 'Предыдущая версия восстановлена и уже доступна в каналах.'
          : 'Предыдущая версия восстановлена. Ваши новые правки остались в редакторе и ещё не сохранены.';
      restored = true;
    } catch (cause: unknown) {
      state.reportFailure(cause);
    } finally {
      state.restoring.value = false;
    }
    if (restored) {
      await refreshHistory(
        'Версия восстановлена, но историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.',
      );
    }
  };

  const resumeAfterAuthentication = async (): Promise<void> => {
    if (!state.loaded.value) {
      await load();
      return;
    }
    if (!historyState.historyLoaded.value) {
      await refreshHistory(
        'Историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.',
      );
    }
  };

  async function refreshHistory(failureMessage: string): Promise<void> {
    const message = await historyState.refreshHistory();
    if (message) {
      state.error.value = failureMessage;
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
