import type { clientPreview } from '@frontend-common/entities/content/lib/client-preview';
import styles from '@frontend/widgets/content-workspace/styles/content-preview.module.css';

export function PreviewConversation({
  response,
  rows,
  text,
  navigate,
}: {
  response: ReturnType<typeof clientPreview>['response'];
  rows: ReturnType<typeof clientPreview>['buttonRows'];
  text: string;
  navigate: (action: string) => void;
}) {
  return (
    <div className={styles['message-preview']} aria-label="Пример переписки">
      <article className={styles['preview-response']} aria-live="polite">
        <p className={styles['preview-service-message']}>{text}</p>
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
      {rows.length > 0 && (
        <div
          className={styles['message-preview-buttons']}
          aria-label="Кнопки бота"
        >
          {rows.map((row, index) => (
            <div
              key={index}
              className={`${styles['message-preview-button-row']} ${row.length === 1 ? styles['message-preview-button-row--single'] : ''}`}
            >
              {row.map((button) => (
                <button
                  key={button.action}
                  type="button"
                  className="secondary-button"
                  onClick={() => navigate(button.action)}
                >
                  {button.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
