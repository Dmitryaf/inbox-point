import { useLayoutEffect, useRef, useState } from 'react';
import type { ContentDraft } from '@frontend-common/entities/content/model/types';
import { clientPreview } from '@frontend-common/entities/content/lib/client-preview';
import styles from '@frontend/widgets/content-workspace/styles/content-preview.module.css';

export function ContentPreview({
  draft,
  start,
}: {
  draft: ContentDraft;
  start: { action: string; sequence: number };
}) {
  const [action, setAction] = useState(start.action);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (start.sequence) {
      heading.current?.focus();
    }
  }, [start.sequence]);
  const { response, buttonRows, empty } = clientPreview(draft, action);
  return (
    <section
      className={`card ${styles.card}`}
      aria-label="Предпросмотр ответов"
    >
      <h2 ref={heading} tabIndex={-1}>
        Предпросмотр ответов
      </h2>
      <p className={styles['preview-intro']}>
        Нажимайте кнопки, чтобы пройти путь клиента. Здесь показаны текст и
        действия; оформление кнопок зависит от VK или Telegram. Сообщения не
        отправляются.
      </p>
      <button
        type="button"
        className="secondary-button"
        onClick={() => setAction('main')}
      >
        Начать с меню
      </button>
      {empty && (
        <p className={styles.empty}>
          Заполните разделы — здесь появится будущий ответ.
        </p>
      )}
      <div className={styles['message-preview']} aria-label="Пример переписки">
        <article className={styles['preview-response']} aria-live="polite">
          <p className={styles['preview-service-message']}>{response.text}</p>
          {response.applicationLabel ? (
            <p className={styles['preview-intro']}>
              Здесь клиент напишет ответ. Он придёт администратору как заявка «
              {response.applicationLabel}».
            </p>
          ) : (
            response.beginQuestion && (
              <p className={styles['preview-intro']}>
                Следующее сообщение клиента придёт администратору
                {response.questionContext ? ' вместе с названием группы' : ''}.
              </p>
            )
          )}
        </article>
        <div
          className={styles['message-preview-buttons']}
          aria-label="Кнопки бота"
        >
          {buttonRows.map((row, index) => (
            <div
              key={index}
              className={`${styles['message-preview-button-row']} ${row.length === 1 ? styles['message-preview-button-row--single'] : ''}`}
            >
              {row.map((button) => (
                <button
                  key={button.action}
                  type="button"
                  className="secondary-button"
                  onClick={() => setAction(button.action)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
