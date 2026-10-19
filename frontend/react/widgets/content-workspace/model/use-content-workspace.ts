import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { HttpError } from '@frontend-common/shared/api/http-client';
import { errorMessage } from '@frontend-common/shared/lib/error-message';
import type { ContentDraft } from '@frontend-common/entities/content/model/types';
import { useAdminSession } from '@frontend/features/admin-auth/model/SessionProvider';
import { preserveDraft } from './draft-recovery';
import { editorKey } from './editor-context';
import {
  initialEditorState,
  isDirty,
  type EditorLifetime,
  type EditorState,
} from './editor-state';
import { loadEditor, refreshHistory, previewRevision } from './editor-reads';
import { createEditorSave } from './editor-save';
import { restoreEditor } from './editor-restore';
import { useEditorExitGuard } from './use-editor-exit-guard';

export function useContentWorkspace() {
  const [state, setState] = useState(initialEditorState);
  const lifetime = useRef<EditorLifetime>({
    state,
    active: false,
    generation: 0,
    command: false,
    released: false,
    previewSequence: 0,
  });
  const cache = useQueryClient();
  const { epoch, expireSession } = useAdminSession();
  const patch = useCallback((change: Partial<EditorState>) => {
    if (lifetime.current.active) {
      lifetime.current.state = { ...lifetime.current.state, ...change };
      setState(lifetime.current.state);
    }
  }, []);
  const report = useCallback(
    (cause: unknown) => {
      if (cause instanceof HttpError && cause.status === 401) {
        const current = lifetime.current;
        try {
          if (current.state.draft && isDirty(current.state)) {
            preserveDraft({
              draft: current.state.draft,
              savedSnapshot: current.state.savedSnapshot,
              version: current.state.version,
            });
          }
        } catch {
          return 'Не удалось сохранить черновик для повторного входа. Скопируйте изменения с этой страницы перед выходом.';
        }
        current.released = true;
        expireSession(epoch);
        return '';
      }
      return errorMessage(cause);
    },
    [epoch, expireSession],
  );
  const operations = useMemo(() => {
    const context = { lifetime, patch, cache, epoch, report };
    return {
      load: () => loadEditor(context),
      refreshHistory: (saved: boolean | 'restored' = false) =>
        refreshHistory(context, saved),
      previewRevision: (revision: number) => previewRevision(context, revision),
      cancelPreview: () => {
        lifetime.current.previewSequence++;
        patch({
          preview: undefined,
          reviewedRevision: undefined,
          previewLoading: false,
        });
      },
      restore: (revision: number) =>
        restoreEditor(context, revision, () =>
          refreshHistory(context, 'restored'),
        ),
      save: () =>
        createEditorSave(context, (saved) => refreshHistory(context, saved))(),
    };
  }, [patch, cache, epoch, report]);
  useEffect(() => {
    const current = lifetime.current;
    current.active = true;
    current.generation++;
    void operations.load();
    return () => {
      current.active = false;
      current.generation++;
      void cache.cancelQueries({ queryKey: editorKey(epoch) });
    };
  }, [operations, cache, epoch]);
  useEditorExitGuard(lifetime);
  function edit(change: Partial<ContentDraft>): void {
    const draft = lifetime.current.state.draft;
    if (draft) {
      patch({ draft: { ...draft, ...change } });
    }
  }
  return { ...state, ...operations, edit, dirty: isDirty(state) };
}
