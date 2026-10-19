import { normalizeContentDraft } from '@frontend-common/entities/content/model/content-draft';
import type { ContentSnapshot } from '@frontend-common/entities/content/model/types';
import styles from '@frontend/entities/content/styles/content-revision.module.css';

export function ContentRevision({ snapshot }: { snapshot: ContentSnapshot }) {
  const content = normalizeContentDraft(snapshot.content);
  return (
    <div className={styles['revision-content']}>
      <section>
        <h3>Название организации</h3>
        <p>
          {content.organizationName?.trim()
            ? content.organizationName
            : 'Не заполнено'}
        </p>
      </section>
      <section>
        <h3>
          Занятия{' '}
          <small>
            {content.visibleSections.includes('schedule')
              ? 'Кнопка включена'
              : 'Скрыто в меню'}
          </small>
        </h3>
        <ul>
          {content.directions.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
        {content.groups.map((group) => (
          <article key={group.id}>
            <h4>{group.name || 'Старое расписание'}</h4>
            <p>{group.meetings.join('\n')}</p>
            <p>{group.description}</p>
            <p>{group.enrollmentOpen ? 'Набор открыт' : 'Набор закрыт'}</p>
            <p>{group.applicationQuestion}</p>
            <p>{group.confirmationText}</p>
            {group.review && <pre>{group.review.source}</pre>}
          </article>
        ))}
        {content.schedule.map((item, index) => (
          <p key={index}>
            {item.title} · {item.dayTime} · {item.description}
          </p>
        ))}
        {content.legacySchedule && <pre>{content.legacySchedule}</pre>}
        {!!content.keywords.length && (
          <ul>
            {content.keywords.map((word, index) => (
              <li key={index}>{word.phrase}</li>
            ))}
          </ul>
        )}
      </section>
      {(['prices', 'address'] as const).map((id) => (
        <section key={id}>
          <h3>
            {id === 'prices' ? 'Цены' : 'Адрес'}{' '}
            <small>
              {content.visibleSections.includes(id)
                ? 'Кнопка включена'
                : 'Скрыто в меню'}
            </small>
          </h3>
          <p>{content[id] || 'Не заполнено'}</p>
        </section>
      ))}
      <section>
        <h3>
          Частые вопросы{' '}
          <small>
            {content.visibleSections.includes('faq')
              ? 'Кнопка включена'
              : 'Скрыто в меню'}
          </small>
        </h3>
        {content.faq.length ? (
          content.faq.map((item, index) => (
            <div key={index}>
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </div>
          ))
        ) : (
          <p>Не заполнено</p>
        )}
      </section>
      <section>
        <h3>Свои разделы</h3>
        {content.customSections.length ? (
          content.customSections.map((item, index) => (
            <div key={item.id ?? index}>
              <strong>{item.label}</strong>
              <p>{item.text}</p>
              <p>
                {item.mode === 'application'
                  ? 'Принять заявку'
                  : 'Показать информацию'}
              </p>
            </div>
          ))
        ) : (
          <p>Не заполнено</p>
        )}
      </section>
    </div>
  );
}
