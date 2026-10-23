import { buildClientResponsePreviews } from '@frontend-common/entities/content/lib/client-response-preview';
import { validateContentDraft } from '@frontend-common/entities/content/lib/content-validation';
import type { ContentDraft } from '@frontend-common/entities/content/model/types';
import styles from '@frontend/entities/content/styles/content-summary.module.css';
export function ContentSummary({ draft }: { draft: ContentDraft }) {
  const responses = buildClientResponsePreviews(draft);
  return (
    <section
      className={styles['content-summary']}
      aria-label="Готовность ответов"
    >
      <p className={styles['summary-heading']}>
        <span className={styles['summary-title']}>
          {!validateContentDraft(draft).valid
            ? 'Нужно исправить поля'
            : responses.length
              ? 'Готово к показу'
              : 'Пока не заполнено'}
        </span>{' '}
        · Ответов в меню: {responses.length}
      </p>
      <dl className={styles['content-facts']}>
        <div>
          <dt>Основные ответы</dt>
          <dd>
            {responses.filter((item) => item.group === 'information').length} из
            4
          </dd>
        </div>
        <div>
          <dt>Частые вопросы</dt>
          <dd>{draft.faq.length}</dd>
        </div>
        <div>
          <dt>Свои разделы</dt>
          <dd>{responses.filter((item) => item.group === 'custom').length}</dd>
        </div>
      </dl>
      <p className={styles['channel-note']}>
        После сохранения изменения появятся в Telegram и VK.
      </p>
    </section>
  );
}
