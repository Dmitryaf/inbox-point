import { OperatorHistory } from './OperatorHistory';
import type { useOperatorInbox } from '@frontend/features/manage-operator-inbox/model/use-operator-inbox';
import type { OperatorInboxRequest } from '@frontend-common/entities/operations/model/types';
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
      <OperatorHistory inbox={inbox} />
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
