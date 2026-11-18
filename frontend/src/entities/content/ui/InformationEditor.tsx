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
            <ShortAnswerField
              draft={draft}
              edit={edit}
              issues={issues}
              field={id}
            />
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

export function ShortAnswerField({
  draft,
  edit,
  issues,
  field,
  inputId = field,
  label = 'Текст ответа',
}: InformationProps & {
  field: 'prices' | 'address';
  inputId?: string;
  label?: string;
}) {
  const length = getCoreResponseLengths(draft)[field];
  return (
    <>
      <ContentField
        id={inputId}
        validationId={field}
        label={label}
        value={draft[field]}
        onChange={(value) => edit({ [field]: value })}
        multiline
        maxLength={4000}
        issues={issues}
      />
      <p
        className={`${styles.counter} ${length > 4000 ? styles['counter--error'] : ''}`}
      >
        Итоговый ответ: {length} / 4000
      </p>
    </>
  );
}
