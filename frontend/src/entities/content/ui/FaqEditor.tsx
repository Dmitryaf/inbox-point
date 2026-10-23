import { useFaqEditor } from '@frontend/entities/content/model/use-faq-editor';
import {
  formatFaqResponse,
  normalizeFaqItems,
} from '@frontend-common/entities/content/lib/client-response-preview';
import type { InformationProps } from './InformationEditor';
import { ContentField } from './ContentField';
import { SectionVisibilityControl } from './SectionVisibilityControl';
import styles from '@frontend/entities/content/styles/collection-editor.module.css';

export function FaqEditor({ draft, edit, issues }: InformationProps) {
  const { keys, add, move, remove } = useFaqEditor({ draft, edit });
  const responseLength = draft.faq.length
    ? formatFaqResponse(normalizeFaqItems(draft.faq)).length
    : 0;
  return (
    <section className="card" aria-label="Частые вопросы">
      <div className={styles['section-heading']}>
        <h2>Частые вопросы</h2>
        <span>{draft.faq.length} / 20</span>
      </div>
      <p>Вопросы показываются в этом порядке.</p>
      <p
        className={`${styles.counter} ${responseLength > 4000 ? styles['counter--error'] : ''}`}
        aria-live="polite"
      >
        Итоговый ответ: {responseLength} / 4000
      </p>
      <SectionVisibilityControl
        draft={draft}
        section="faq"
        present={draft.faq.length > 0}
        onChange={edit}
      />
      {!draft.faq.length && (
        <p className={styles.empty}>
          Добавьте хотя бы один вопрос и ответ, чтобы показать этот раздел.
        </p>
      )}
      {draft.faq.map((item, index) => (
        <fieldset key={keys[index]} className={styles['item-card']}>
          <legend>Вопрос {index + 1}</legend>
          {(['question', 'answer'] as const).map((field) => (
            <ContentField
              key={field}
              id={`faq-${field}-${index}`}
              label={field === 'question' ? 'Вопрос' : 'Ответ'}
              value={item[field]}
              multiline={field === 'answer'}
              maxLength={field === 'question' ? 300 : 3000}
              issues={issues}
              onChange={(value) =>
                edit({
                  faq: draft.faq.map((entry, itemIndex) =>
                    itemIndex === index ? { ...entry, [field]: value } : entry,
                  ),
                })
              }
            />
          ))}
          <div className={styles['item-actions']}>
            <button
              className="quiet"
              type="button"
              disabled={index === 0}
              aria-label={`Переместить вопрос ${index + 1} выше`}
              data-move="-1"
              onClick={() => move(index, -1)}
            >
              Выше
            </button>
            <button
              className="quiet"
              type="button"
              disabled={index === draft.faq.length - 1}
              aria-label={`Переместить вопрос ${index + 1} ниже`}
              data-move="1"
              onClick={() => move(index, 1)}
            >
              Ниже
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => remove(index)}
            >
              Удалить
            </button>
          </div>
        </fieldset>
      ))}
      <button
        id="add-faq-question"
        type="button"
        disabled={draft.faq.length >= 20}
        onClick={add}
      >
        Добавить вопрос
      </button>
    </section>
  );
}
