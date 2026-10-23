import type {
  ContentDraft,
  ContentValidationIssue,
} from '@frontend-common/entities/content/model/types';
import { getCoreResponseLengths } from '@frontend-common/entities/content/lib/content-response-limit';
import { ContentField } from './ContentField';
import { FaqEditor } from './FaqEditor';
import { SectionVisibilityControl } from './SectionVisibilityControl';
import styles from '@frontend/entities/content/styles/core-sections-fields.module.css';
import layout from '@frontend/entities/content/styles/information-editor.module.css';

export interface InformationProps {
  draft: ContentDraft;
  edit: (change: Partial<ContentDraft>) => void;
  issues: readonly ContentValidationIssue[];
  revision?: number;
}
export function InformationEditor({
  draft,
  edit,
  issues,
  revision = 0,
}: InformationProps) {
  const lengths = getCoreResponseLengths(draft);
  return (
    <div className={layout.editor}>
      <h2>Информация</h2>
      <section className={styles.card} aria-label="Основные ответы">
        {(['prices', 'address'] as const).map((id) => (
          <details key={id} className={styles['field-group']}>
            <summary>
              <strong>{id === 'prices' ? 'Цены' : 'Адрес'}</strong>
              <span className={styles['summary-meta']}>
                <small>{draft[id].trim() ? 'Заполнено' : 'Не заполнено'}</small>
                <span
                  className={styles['disclosure-chevron']}
                  aria-hidden="true"
                />
              </span>
            </summary>
            <ContentField
              id={id}
              label="Текст ответа"
              value={draft[id]}
              onChange={(value) => edit({ [id]: value })}
              multiline
              maxLength={4000}
              issues={issues}
            />
            <p
              className={`${styles.counter} ${lengths[id] > 4000 ? styles['counter--error'] : ''}`}
            >
              Итоговый ответ: {lengths[id]} / 4000
            </p>
            <SectionVisibilityControl
              draft={draft}
              section={id}
              present={!!draft[id].trim()}
              onChange={edit}
            />
          </details>
        ))}
      </section>
      <FaqEditor key={revision} draft={draft} edit={edit} issues={issues} />
    </div>
  );
}
