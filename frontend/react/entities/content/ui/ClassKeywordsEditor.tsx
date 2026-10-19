import { groupTitle, normalizeKeyword } from '@core/application/class-content';
import type {
  ContentEditorProps,
  OpenClass,
} from '@frontend/entities/content/model/editor-props';
import styles from '@frontend/entities/content/styles/class-editor.module.css';

export function ClassKeywordsEditor({
  draft,
  edit,
  targetId,
  open,
}: ContentEditorProps & { targetId: string; open: OpenClass }) {
  const words = draft.keywords
    .map((word, index) => ({ word, index }))
    .filter(
      ({ word }) => word.targetType === 'group' && word.targetId === targetId,
    );
  return (
    <section
      className={styles['class-card']}
      aria-label="Переход из объявления"
    >
      <h3>Переход из объявления</h3>
      <p>По этому слову в сообщениях бот покажет эту группу.</p>
      {words.map(({ word, index }, localIndex) => {
        const conflict = draft.keywords.find(
          (other) =>
            other !== word &&
            other.targetType === 'group' &&
            !!word.phrase.trim() &&
            normalizeKeyword(other.phrase) === normalizeKeyword(word.phrase),
        );
        const group =
          conflict &&
          draft.groups.find((item) => item.id === conflict.targetId);
        return (
          <div key={index} className={styles['class-word']}>
            <label htmlFor={`keyword-${targetId}-${localIndex}`}>
              Слово или фраза {localIndex + 1}
            </label>
            <input
              id={`keyword-${targetId}-${localIndex}`}
              value={word.phrase}
              maxLength={80}
              placeholder="Например, Бачата"
              onChange={(event) =>
                edit({
                  keywords: draft.keywords.map((entry, itemIndex) =>
                    itemIndex === index
                      ? { ...entry, phrase: event.target.value }
                      : entry,
                  ),
                })
              }
            />
            {conflict && (
              <p role="alert">
                Слово «{word.phrase}» уже открывает «
                {group ? groupTitle(draft, group) : ''}».{' '}
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => open(conflict.targetType, conflict.targetId)}
                >
                  Перейти к настройке
                </button>
              </p>
            )}
            <button
              type="button"
              className="danger"
              onClick={() =>
                edit({
                  keywords: draft.keywords.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            >
              Удалить слово
            </button>
          </div>
        );
      })}
      <button
        type="button"
        disabled={draft.keywords.length >= 40}
        onClick={() =>
          edit({
            keywords: [
              ...draft.keywords,
              { phrase: '', targetType: 'group', targetId },
            ],
          })
        }
      >
        Добавить ключевое слово
      </button>
    </section>
  );
}
