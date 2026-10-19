import { saveContent } from '@frontend-common/entities/content/api/content-api';
import {
  copyContentDraft,
  normalizeContentDraft,
  snapshotContent,
} from '@frontend-common/entities/content/model/content-draft';
import { validateContentDraft } from '@frontend-common/entities/content/lib/content-validation';
import { editorKey, isCurrent, type EditorContext } from './editor-context';
import { isDirty } from './editor-state';

export function createEditorSave(
  context: EditorContext,
  refreshHistory: (saved: boolean) => Promise<void>,
) {
  return async function save(): Promise<void> {
    const { lifetime, patch, cache, epoch, report } = context;
    const state = lifetime.current.state;
    if (!state.draft || lifetime.current.command || !isDirty(state)) {
      return;
    }
    const validation = validateContentDraft(state.draft);
    const issue = validation.issues[0];
    if (issue) {
      patch({ error: validation.message, notice: '' });
      const field = document.getElementById(issue.fieldId);
      const details = field?.closest('details');
      if (details) {
        details.open = true;
      }
      field?.focus();
      return;
    }
    lifetime.current.command = true;
    const generation = lifetime.current.generation;
    const submission = copyContentDraft(state.draft);
    const submittedSnapshot = snapshotContent(submission);
    patch({ saving: true, error: '', notice: '' });
    try {
      const result = await saveContent(submission, state.version);
      if (!isCurrent(context, generation)) {
        return;
      }
      const saved = normalizeContentDraft(result.content);
      const latest = lifetime.current.state.draft;
      patch({
        version: result.version,
        savedSnapshot: snapshotContent(saved),
        ...(latest && snapshotContent(latest) === submittedSnapshot
          ? {
              draft: saved,
              draftRevision: lifetime.current.state.draftRevision + 1,
            }
          : {}),
        notice:
          'Информация сохранена. Новые ответы доступны сразу. Открытые у клиентов кнопки обновятся со следующим ответом бота. Если клиент нажмёт кнопку из недавней версии меню, бот покажет актуальные варианты без создания обращения.',
      });
      cache.setQueryData([...editorKey(epoch), 'content'], result);
      cache.setQueryData(
        ['session', epoch, 'organization'],
        result.content.organizationName ?? '',
      );
      await refreshHistory(true);
    } catch (cause: unknown) {
      if (isCurrent(context, generation)) {
        const message = report(cause);
        if (message) {
          patch({
            error: `${message} Ваши изменения остались на этой странице.`,
          });
        }
      }
    } finally {
      lifetime.current.command = false;
      if (isCurrent(context, generation)) {
        patch({ saving: false });
      }
    }
  };
}
