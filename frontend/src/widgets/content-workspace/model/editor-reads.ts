import {
  loadContent,
  loadContentHistory,
  loadContentRevision,
} from '@frontend-common/entities/content/api/content-api';
import {
  normalizeContentDraft,
  snapshotContent,
} from '@frontend-common/entities/content/model/content-draft';
import { takeDraftRecovery } from './draft-recovery';
import { editorKey, isCurrent, type EditorContext } from './editor-context';

export async function refreshHistory(
  context: EditorContext,
  saved: boolean | 'restored' = false,
): Promise<void> {
  const { lifetime, patch, cache, epoch, report } = context;
  const key = editorKey(epoch);
  const generation = lifetime.current.generation;
  patch({ historyLoading: true, historyError: '' });
  try {
    const history = await cache.fetchQuery({
      queryKey: [...key, 'history'],
      queryFn: ({ signal }) => loadContentHistory(signal),
      staleTime: 0,
    });
    if (isCurrent(context, generation)) {
      patch({ history });
    }
  } catch (cause: unknown) {
    if (isCurrent(context, generation)) {
      const message = report(cause);
      if (message) {
        patch({
          historyError:
            saved === 'restored'
              ? 'Версия восстановлена, но историю изменений сейчас открыть нельзя. Попробуйте обновить страницу позже.'
              : `Информация ${saved ? 'сохранена' : 'загружена'}, но историю изменений сейчас открыть нельзя. Попробуйте обновить историю позже.`,
        });
      }
    }
  } finally {
    if (isCurrent(context, generation)) {
      patch({ historyLoading: false });
    }
  }
}
export async function loadEditor(context: EditorContext): Promise<void> {
  const { lifetime, patch, cache, epoch, report } = context;
  const key = editorKey(epoch);
  if (lifetime.current.state.draft) {
    return;
  }
  const generation = lifetime.current.generation;
  patch({ loading: true, error: '', notice: '' });
  try {
    const result = await cache.fetchQuery({
      queryKey: [...key, 'content'],
      queryFn: ({ signal }) => loadContent(signal),
      staleTime: 0,
    });
    if (!isCurrent(context, generation) || lifetime.current.state.draft) {
      return;
    }
    const saved = normalizeContentDraft(result.content);
    const recovery = takeDraftRecovery();
    patch({
      draft: recovery?.draft ?? saved,
      draftRevision: lifetime.current.state.draftRevision + 1,
      savedSnapshot: recovery?.savedSnapshot ?? snapshotContent(saved),
      version: recovery?.version ?? result.version,
      notice: recovery ? 'Несохранённый черновик восстановлен.' : '',
    });
    cache.setQueryData(
      ['session', epoch, 'organization'],
      result.content.organizationName ?? '',
    );
  } catch (cause: unknown) {
    if (isCurrent(context, generation)) {
      patch({ error: report(cause) });
    }
  } finally {
    if (isCurrent(context, generation)) {
      patch({ loading: false });
    }
  }
  if (isCurrent(context, generation) && lifetime.current.state.draft) {
    await refreshHistory(context);
  }
}
export async function previewRevision(
  context: EditorContext,
  revision: number,
): Promise<void> {
  const { lifetime, patch, cache, epoch, report } = context;
  const key = editorKey(epoch);
  const generation = lifetime.current.generation;
  const sequence = ++lifetime.current.previewSequence;
  patch({
    preview: undefined,
    reviewedRevision: undefined,
    previewLoading: true,
    error: '',
  });
  try {
    const preview = await cache.fetchQuery({
      queryKey: [...key, 'revision', revision],
      queryFn: ({ signal }) => loadContentRevision(revision, signal),
      staleTime: 0,
    });
    if (
      isCurrent(context, generation) &&
      sequence === lifetime.current.previewSequence
    ) {
      patch({ preview, reviewedRevision: revision });
    }
  } catch (cause: unknown) {
    if (
      isCurrent(context, generation) &&
      sequence === lifetime.current.previewSequence
    ) {
      patch({ error: report(cause) });
    }
  } finally {
    if (
      isCurrent(context, generation) &&
      sequence === lifetime.current.previewSequence
    ) {
      patch({ previewLoading: false });
    }
  }
}
