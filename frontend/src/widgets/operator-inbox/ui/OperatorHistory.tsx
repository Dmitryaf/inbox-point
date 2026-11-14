import type { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';
import { formatShortDateTime } from '@frontend-common/shared/lib/format-date-time';
import { deliveryLabel } from '@frontend-common/entities/operations/lib/message-presentation';
import { AsyncMessage } from '@frontend/shared/ui/AsyncMessage';
import styles from '@frontend/widgets/operator-inbox/styles/operator-conversation.module.css';
export function OperatorHistory({
  inbox,
}: {
  inbox: ReturnType<typeof useOperatorInbox>;
}) {
  const { state } = inbox;
  return (
    <>
      {' '}
      <AsyncMessage kind="error" text={state.moreMessagesError} />
      {state.messagesCursor && (
        <button
          type="button"
          disabled={
            state.loading ||
            state.messagesLoading ||
            state.moreMessagesLoading ||
            state.actionPending
          }
          onClick={inbox.loadOlder}
        >
          {state.moreMessagesLoading
            ? 'Загружаем сообщения…'
            : 'Загрузить предыдущие сообщения'}
        </button>
      )}
      {state.messagesLoading ? (
        <p role="status">Загружаем переписку…</p>
      ) : state.messagesError ? (
        <div>
          <AsyncMessage kind="error" text={state.messagesError} />
          <button
            type="button"
            className="secondary-button"
            onClick={inbox.retryMessages}
          >
            Повторить загрузку переписки
          </button>
        </div>
      ) : null}
      {state.messages.length > 0 ? (
        <ol
          className={styles['operator-message-list']}
          aria-label="Переписка"
          tabIndex={0}
        >
          {state.messages.map((message) => (
            <li
              key={message.id}
              className={`${styles['operator-message']} ${styles[`operator-message--${message.direction}`] ?? ''}`}
            >
              <div className={styles['operator-message-meta']}>
                <strong>
                  {message.direction === 'client_to_operator'
                    ? message.senderName?.length
                      ? message.senderName
                      : 'Отправитель'
                    : 'Администратор'}
                </strong>
                <time dateTime={message.createdAt}>
                  {formatShortDateTime(message.createdAt)}
                </time>
              </div>
              <p>{message.text}</p>
              {deliveryLabel(message) && (
                <span
                  className={`${styles['operator-message-delivery']} ${message.deliveryStatus === 'failed' ? styles['operator-message-delivery--failed'] : ''}`}
                >
                  {deliveryLabel(message)}
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : inbox.ready ? (
        <p className={styles['operator-inbox-empty']}>Сообщений пока нет.</p>
      ) : null}
    </>
  );
}
