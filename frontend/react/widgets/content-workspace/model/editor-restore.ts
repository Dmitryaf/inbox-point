import { restoreContent } from '@frontend-common/entities/content/api/content-api';
import {
  normalizeContentDraft,
  snapshotContent,
} from '@frontend-common/entities/content/model/content-draft';
import { editorKey, isCurrent, type EditorContext } from './editor-context';

export async function restoreEditor(
  context: EditorContext,
  revision: number,
  refreshHistory: () => Promise<void>,
): Promise<void> {
  const { lifetime, patch, cache, epoch, report } = context;
  const state = lifetime.current.state;
  if (
    !state.draft ||
    lifetime.current.command ||
    state.previewLoading ||
    !state.preview ||
    state.reviewedRevision !== revision
  ) {
    return;
  }
  lifetime.current.command = true;
  const generation = lifetime.current.generation;
  const startedSnapshot = snapshotContent(state.draft);
  patch({ restoring: true, error: '', notice: '' });
  try {
    const result = await restoreContent(revision, state.version);
    if (!isCurrent(context, generation)) {
      return;
    }
    const restored = normalizeContentDraft(result.content);
    const savedSnapshot = snapshotContent(restored);
    const unchanged =
      !!lifetime.current.state.draft &&
      snapshotContent(lifetime.current.state.draft) === startedSnapshot;
    patch({
      version: result.version,
      savedSnapshot,
      ...(unchanged
        ? {
            draft: restored,
            draftRevision: lifetime.current.state.draftRevision + 1,
          }
        : {}),
      preview: undefined,
      reviewedRevision: undefined,
      notice:
        unchanged ||
        (!!lifetime.current.state.draft &&
          snapshotContent(lifetime.current.state.draft) === savedSnapshot)
          ? 'Предыдущая версия восстановлена. Новые ответы доступны сразу, а кнопки обновятся со следующим сообщением бота.'
          : 'Предыдущая версия восстановлена. Ваши новые правки остались в редакторе и ещё не сохранены.',
    });
    cache.setQueryData([...editorKey(epoch), 'content'], result);
    cache.setQueryData(
      ['session', epoch, 'organization'],
      result.content.organizationName ?? '',
    );
    await refreshHistory();
  } catch (cause: unknown) {
    if (isCurrent(context, generation)) {
      patch({ error: report(cause) });
    }
  } finally {
    lifetime.current.command = false;
    if (isCurrent(context, generation)) {
      patch({ restoring: false });
    }
  }
}
