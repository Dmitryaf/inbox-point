import type { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';
import { formatShortDateTime } from '@frontend-common/shared/lib/format-date-time';
import type { OperatorInboxRequest } from '@frontend-common/entities/operations/model/types';
import { deliveryLabel } from '@frontend-common/entities/operations/lib/message-presentation';
import { AsyncMessage } from '@frontend/shared/ui/AsyncMessage';
import styles from '@frontend/widgets/operator-inbox/styles/operator-conversation.module.css';

export function OperatorConversation({
  inbox,
  request,
}: {
  inbox: ReturnType<typeof useOperatorInbox>;
  request: OperatorInboxRequest;
}) {
  const { state } = inbox;
  const draft = state.drafts[request.id] ?? '';
  function close() {
    if (
      window.confirm(
        'Закрыть обращение? Чтобы обратиться снова, клиенту нужно будет выбрать «Задать вопрос» и написать сообщение.',
      )
    ) {
      inbox.close();
    }
  }
  return (
    <article
      className={styles['operator-conversation']}
      aria-label="Выбранное обращение"
    >
      <header className={styles['operator-conversation-heading']}>
        <div>
          <h3>
            {request.displayName?.length ? request.displayName : 'Без имени'}
          </h3>
          <p>{request.channel === 'telegram' ? 'Telegram' : 'VK'}</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={state.actionPending || !inbox.ready}
          onClick={close}
        >
          Закрыть обращение
        </button>
      </header>
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
      <form
        className={styles['operator-reply-form']}
        onSubmit={(event) => {
          event.preventDefault();
          inbox.reply(draft);
        }}
      >
        <label htmlFor="operator-reply">Ответ</label>
        <textarea
          id="operator-reply"
          value={draft}
          onChange={(event) => inbox.setDraft(request.id, event.target.value)}
          maxLength={4000}
          required
          rows={4}
        />
        <div className={styles['operator-reply-actions']}>
          <span>{draft.length} / 4000</span>
          <button
            type="submit"
            disabled={state.actionPending || !inbox.ready || !draft.trim()}
          >
            {state.actionPending ? 'Готовим к отправке…' : 'Отправить'}
          </button>
        </div>
      </form>
    </article>
  );
}
